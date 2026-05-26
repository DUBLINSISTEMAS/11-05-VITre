/**
 * Setup do DB ephemeral pra rodar integration tests RLS no CI.
 *
 * Plano (S0.2 do PLANO-ENDURECIMENTO.md):
 *   1. Conecta como superuser (postgres) no Postgres ephemeral do GH Actions.
 *   2. Cria roles auxiliares (anon, authenticated) que SQLs do projeto usam
 *      em GRANTs sem o schema auth do Supabase precisar existir.
 *   3. Habilita extensions (pg_trgm + pgcrypto).
 *   4. Aplica o schema Drizzle (drizzle-kit export) — gera DDL pra DB vazia.
 *   5. Aplica todos os SQLs em supabase/sql/* em ordem, EXCETO:
 *      - 02_storage_buckets.sql (depende do schema `storage` do Supabase)
 *      - 99_cleanup_orphan_drafts.sql (limpeza pontual, não estrutural)
 *      Substitui __VITRE_APP_PASSWORD__ por env var antes de aplicar 09_*.
 *   6. Seed mínimo: 2 stores reais pra rls-cross-tenant.test.ts ter
 *      `existingStoreId` que dispare WITH CHECK (não FK violation).
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

async function step(name, fn) {
  console.log(`\n━━━ ${name} ━━━`);
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

async function run() {
  console.log(`POSTGRES_URL=${POSTGRES_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`VITRE_APP_PASSWORD length=${VITRE_APP_PASSWORD.length}`);
  console.log(`SQL_DIR=${SQL_DIR}`);

  // ---- 1. Conexão superuser
  let root;
  await step("Conectar como superuser", async () => {
    root = new pg.Client({ connectionString: POSTGRES_URL });
    await root.connect();
    const r = await root.query("SELECT current_user, current_database()");
    console.log(`  current_user=${r.rows[0].current_user} db=${r.rows[0].current_database}`);
  });

  // ---- 2. Roles auxiliares
  await step("Criar roles anon + authenticated", async () => {
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
  });

  // ---- 3. Extensions
  await step("Habilitar extensions pg_trgm + pgcrypto", async () => {
    await root.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await root.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  });

  await root.end();

  // ---- 4. Drizzle export
  let exportedSql;
  await step("Exportar Drizzle schema via drizzle-kit export --sql", async () => {
    process.env.DIRECT_URL = POSTGRES_URL;
    process.env.DATABASE_URL = POSTGRES_URL;
    let exportedRaw;
    try {
      exportedRaw = execSync("pnpm exec drizzle-kit export --sql", {
        env: process.env,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      // execSync error com stdout/stderr expostos pra debug
      console.error("drizzle-kit export FALHOU:");
      console.error("  stdout:", e.stdout?.toString?.() ?? "(vazio)");
      console.error("  stderr:", e.stderr?.toString?.() ?? "(vazio)");
      throw e;
    }
    console.log(`  raw len: ${exportedRaw.length}`);
    console.log(`  first 200 chars: ${exportedRaw.slice(0, 200)}`);

    const sqlStart = exportedRaw.search(/^(CREATE|ALTER|--|DO \$\$|INSERT)/m);
    exportedSql = sqlStart >= 0 ? exportedRaw.slice(sqlStart) : exportedRaw;
    if (!exportedSql.trim() || !exportedSql.includes("CREATE TABLE")) {
      throw new Error(
        `drizzle-kit export retornou conteúdo inválido — sqlStart=${sqlStart}`,
      );
    }
    console.log(`  clean len: ${exportedSql.length}`);
  });

  // ---- 5. Aplicar Drizzle schema
  await step("Aplicar Drizzle schema no Postgres", async () => {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();
    try {
      await client.query(exportedSql);
    } finally {
      await client.end();
    }
  });

  // ---- 6. Aplicar SQLs do supabase/sql/*
  const files = (await readdir(SQL_DIR))
    .filter((f) => f.endsWith(".sql") && !SKIP_FILES.has(f))
    .sort((a, b) => {
      const an = parseInt(a.split("_")[0], 10);
      const bn = parseInt(b.split("_")[0], 10);
      return an - bn;
    });

  console.log(`\n━━━ Aplicar ${files.length} SQLs supabase/sql/* ━━━`);
  const client2 = new pg.Client({ connectionString: POSTGRES_URL });
  await client2.connect();

  for (const file of files) {
    let sql = await readFile(path.join(SQL_DIR, file), "utf8");
    if (file.startsWith("09_")) {
      sql = sql.replaceAll("__VITRE_APP_PASSWORD__", VITRE_APP_PASSWORD);
    }
    try {
      await client2.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      // Em CI o Drizzle export JÁ criou tabelas/colunas/types do schema.
      // SQLs do supabase/sql/* que adicionam coluna via ALTER TABLE ADD COLUMN
      // (sem IF NOT EXISTS) conflitam. Em PROD os SQLs são aplicados em ordem
      // antes do Drizzle existir, então o erro NÃO ocorre lá — é específico
      // do setup CI. Toleramos esses códigos:
      //   42P07 = duplicate_table        42701 = duplicate_column
      //   42710 = duplicate_object       42P06 = duplicate_schema
      //   42P16 = invalid_table_definition (constraint já existe)
      //   42704 = undefined_object (DROP IF EXISTS quando objeto não existe)
      const TOLERATED = new Set(["42P07", "42701", "42710", "42P06", "42P16"]);
      if (TOLERATED.has(err.code)) {
        console.log(`  ⚠ ${file} (${err.code}: ${err.message.split("\n")[0]})`);
        continue;
      }
      console.error(`  ✗ ${file}`);
      console.error(`    error: ${err.message}`);
      console.error(`    code: ${err.code} severity: ${err.severity}`);
      if (err.position) {
        const idx = parseInt(err.position, 10);
        const snippet = sql.slice(Math.max(0, idx - 120), idx + 120);
        console.error(`    near (pos ${idx}): ...${snippet}...`);
      }
      throw err;
    }
  }

  // ---- 7. GRANT em TODAS as tabelas pra vitre_app
  // SQL 09 dá GRANT explícito apenas em 6 tabelas + DEFAULT PRIVILEGES pra
  // FUTURAS. Mas no CI a ordem é: Drizzle export cria todas tabelas →
  // SQL 09 cria role + grants. As tabelas Drizzle ficam sem grant.
  //
  // Solução robusta: client fresh (não o client2 que aplicou SQLs e pode
  // ter ficado em estado degradado por erros tolerados) + valida via
  // information_schema que o grant pegou.
  await step("GRANT em todas tabelas pra vitre_app", async () => {
    const grantClient = new pg.Client({ connectionString: POSTGRES_URL });
    await grantClient.connect();
    try {
      await grantClient.query(`GRANT USAGE ON SCHEMA public TO vitre_app`);
      await grantClient.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vitre_app`,
      );
      await grantClient.query(
        `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vitre_app`,
      );

      // Validação: lista 3 tabelas que ANTES falhavam (order_payment,
      // customer, supplier) e confirma que vitre_app tem SELECT nelas.
      const check = await grantClient.query(`
        SELECT table_name, privilege_type
          FROM information_schema.table_privileges
         WHERE grantee = 'vitre_app'
           AND privilege_type = 'SELECT'
           AND table_name IN ('order_payment', 'customer', 'supplier', 'audit_event', 'lead')
         ORDER BY table_name
      `);
      console.log(`  grants confirmados (${check.rows.length} rows):`);
      for (const row of check.rows) {
        console.log(`    ${row.table_name} → ${row.privilege_type}`);
      }
      if (check.rows.length < 5) {
        throw new Error(
          `GRANT não pegou em todas tabelas — esperava 5, recebi ${check.rows.length}. Veja log acima.`,
        );
      }
    } finally {
      await grantClient.end();
    }
  });

  // ---- 8. Seed
  await step("Seed mínimo (2 users + 2 stores)", async () => {
    // store.owner_id é FK pra user.id (Better Auth schema). Cria 2 users
    // fake antes do store pra FK passar.
    await client2.query(`
      INSERT INTO "user" (id, email, name, email_verified, created_at, updated_at)
      VALUES
        ('ci-test-user-a', 'ci-a@test.local', 'CI Test User A', true, now(), now()),
        ('ci-test-user-b', 'ci-b@test.local', 'CI Test User B', true, now(), now())
      ON CONFLICT (id) DO NOTHING
    `);
    await client2.query(`
      INSERT INTO store (slug, name, owner_id, whatsapp_number, whatsapp_display, is_active)
      VALUES
        ('ci-test-loja-a', 'CI Test Loja A', 'ci-test-user-a', '+5511000000001', '(11) 0000-0001', true),
        ('ci-test-loja-b', 'CI Test Loja B', 'ci-test-user-b', '+5511000000002', '(11) 0000-0002', true)
      ON CONFLICT (slug) DO NOTHING
    `);
  });

  await client2.end();

  // ---- 8. Output pra próximo step
  const u = new URL(POSTGRES_URL);
  u.username = "vitre_app";
  u.password = VITRE_APP_PASSWORD;
  const vitreAppUrl = u.toString();
  console.log("\n=== SETUP COMPLETO ===");
  console.log(`DATABASE_URL=${vitreAppUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`DIRECT_URL=${POSTGRES_URL.replace(/:[^:@]+@/, ":***@")}`);

  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `database_url=${vitreAppUrl}\n` + `direct_url=${POSTGRES_URL}\n`,
    );
  }
}

run().catch((err) => {
  console.error("\n========== FATAL ==========");
  console.error(err);
  process.exit(1);
});
