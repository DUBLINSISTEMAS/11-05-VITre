/**
 * Setup do DB ephemeral pra rodar integration tests RLS no CI.
 *
 * Plano (S0.2 do PLANO-ENDURECIMENTO.md):
 *   1. Conecta como superuser (postgres) no Postgres ephemeral do GH Actions.
 *   2. Cria roles auxiliares (anon, authenticated) que SQLs do projeto usam
 *      em GRANTs sem o schema auth do Supabase precisar existir.
 *   3. Habilita extensions (pg_trgm é a única referenciada hoje).
 *   4. Aplica o schema Drizzle (drizzle-kit push --force) — cria tabelas
 *      sem precisar do histórico Supabase de migrations.
 *   5. Aplica todos os SQLs em supabase/sql/* em ordem, EXCETO:
 *      - 02_storage_buckets.sql (depende do schema `storage` do Supabase)
 *      - 99_cleanup_orphan_drafts.sql (limpeza pontual, não estrutural)
 *      Substitui __VITRE_APP_PASSWORD__ por env var antes de aplicar 09_*.
 *   6. Seed mínimo: 2 stores reais pra rls-cross-tenant.test.ts ter
 *      `existingStoreId` que dispare WITH CHECK (não FK violation).
 *
 * Uso:
 *   POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres \
 *   VITRE_APP_PASSWORD=ci-test-pass-32chars-no-quotes-please \
 *     node --env-file-if-exists=.env.local scripts/ci-setup-integration-db.mjs
 *
 * Output:
 *   - imprime DATABASE_URL final (vitre_app:senha@host) pra ser consumida
 *     pelo step seguinte do workflow via $GITHUB_OUTPUT.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

import pg from "pg";

const POSTGRES_URL = process.env.POSTGRES_URL;
const VITRE_APP_PASSWORD = process.env.VITRE_APP_PASSWORD;

if (!POSTGRES_URL) {
  console.error("ERRO: POSTGRES_URL ausente (precisa ser superuser)");
  process.exit(1);
}
if (!VITRE_APP_PASSWORD || VITRE_APP_PASSWORD.length < 16) {
  console.error("ERRO: VITRE_APP_PASSWORD ausente ou < 16 chars");
  process.exit(1);
}

const SQL_DIR = path.resolve(process.cwd(), "supabase/sql");
const SKIP_FILES = new Set([
  "02_storage_buckets.sql", // depende de schema `storage` do Supabase
  "99_cleanup_orphan_drafts.sql", // cleanup pontual, não estrutural
  // 15 OK porque criamos roles anon+authenticated antes (REVOKE funciona)
]);

async function run() {
  const root = new pg.Client({ connectionString: POSTGRES_URL });
  await root.connect();
  console.log("✓ conectado como superuser");

  // 1. Roles auxiliares pra GRANTs do Supabase compilarem
  await root.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;
  `);
  console.log("✓ roles auxiliares (anon, authenticated) garantidas");

  // 2. Extensions
  await root.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await root.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  console.log("✓ extensions pg_trgm + pgcrypto");

  await root.end();

  // 3. Drizzle schema — usa `drizzle-kit export` (não-interativo, gera SQL
  // pra DB vazia) e aplica via pg client. `push` seria interativo em CI.
  process.env.DIRECT_URL = POSTGRES_URL;
  process.env.DATABASE_URL = POSTGRES_URL;
  console.log("→ exportando Drizzle schema via drizzle-kit export --sql...");
  const exportedRaw = execSync("pnpm exec drizzle-kit export --sql", {
    env: process.env,
    encoding: "utf8",
  });
  // drizzle-kit imprime linha de log "◇ injected env..." no início, junto com
  // o SQL. Filtra qualquer linha que não pareça SQL válido (segura: corta no
  // primeiro `CREATE` / `ALTER` / `--` / linha vazia).
  const sqlStart = exportedRaw.search(/^(CREATE|ALTER|--|DO \$\$|INSERT)/m);
  const exportedSql = sqlStart >= 0 ? exportedRaw.slice(sqlStart) : exportedRaw;
  if (!exportedSql.trim() || !exportedSql.includes("CREATE TABLE")) {
    throw new Error(
      "drizzle-kit export retornou conteúdo inválido — schema não detectado",
    );
  }

  const root3 = new pg.Client({ connectionString: POSTGRES_URL });
  await root3.connect();
  await root3.query(exportedSql);
  await root3.end();
  console.log(`✓ Drizzle schema aplicado (${exportedSql.split("\n").length} linhas SQL)`);

  // 4. Aplica supabase/sql/* em ordem
  const files = (await readdir(SQL_DIR))
    .filter((f) => f.endsWith(".sql") && !SKIP_FILES.has(f))
    .sort((a, b) => {
      // ordena numericamente pelo prefixo (01_, 02_, ..., 72_)
      const an = parseInt(a.split("_")[0], 10);
      const bn = parseInt(b.split("_")[0], 10);
      return an - bn;
    });

  const root2 = new pg.Client({ connectionString: POSTGRES_URL });
  await root2.connect();

  console.log(`→ aplicando ${files.length} SQLs de supabase/sql/* ...`);
  for (const file of files) {
    let sql = await readFile(path.join(SQL_DIR, file), "utf8");
    if (file.startsWith("09_")) {
      sql = sql.replaceAll("__VITRE_APP_PASSWORD__", VITRE_APP_PASSWORD);
    }
    try {
      await root2.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}`);
      console.error(`    error: ${err.message}`);
      if (err.position) {
        const idx = parseInt(err.position, 10);
        const snippet = sql.slice(Math.max(0, idx - 80), idx + 80);
        console.error(`    near (pos ${idx}): ...${snippet}...`);
      }
      throw err;
    }
  }

  // 5. Seed mínimo: 2 stores reais
  // Importante: rls-cross-tenant.test.ts precisa encontrar UM store_id real
  // ativo pra disparar WITH CHECK ao tentar INSERT cross-tenant. Sem isso o
  // FK violation (store_id inexistente) mata o teste antes da policy.
  await root2.query(`
    INSERT INTO store (slug, name, owner_user_id, is_active)
    VALUES
      ('ci-test-loja-a', 'CI Test Loja A', gen_random_uuid(), true),
      ('ci-test-loja-b', 'CI Test Loja B', gen_random_uuid(), true)
    ON CONFLICT (slug) DO NOTHING
  `);
  console.log("✓ seed mínimo (2 stores)");

  await root2.end();

  // 6. Imprime DATABASE_URL final pro próximo step do workflow
  const u = new URL(POSTGRES_URL);
  u.username = "vitre_app";
  u.password = VITRE_APP_PASSWORD;
  const vitreAppUrl = u.toString();
  console.log("");
  console.log("=== SETUP COMPLETO ===");
  console.log(`DATABASE_URL=${vitreAppUrl}`);
  console.log(`DIRECT_URL=${POSTGRES_URL}`);

  // GH Actions: escreve no $GITHUB_OUTPUT pra próximo step consumir
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `database_url=${vitreAppUrl}\n` + `direct_url=${POSTGRES_URL}\n`,
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
