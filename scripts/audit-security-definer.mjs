/**
 * Sprint 6D — auditoria de Postgres functions com SECURITY DEFINER.
 *
 * Functions com SECURITY DEFINER rodam com privilégios do OWNER, NÃO
 * do caller. Isso significa que bypassam RLS — qualquer chamada
 * autorizada à function vê dados de TODAS as lojas.
 *
 * Lista TODAS as functions com prosecdef = true. Anota:
 *   - schema.nome
 *   - owner
 *   - prosrc trecho (primeiras 200 chars pra contexto)
 *
 * Output: console table — copia pra revisar manualmente.
 *
 * Uso: `node scripts/audit-security-definer.mjs`
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    throw new Error("DIRECT_URL ausente em .env.local");
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(`
      SELECT
        n.nspname AS schema,
        p.proname AS name,
        pg_get_userbyid(p.proowner) AS owner,
        l.lanname AS language,
        LEFT(p.prosrc, 200) AS prosrc_preview,
        p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE p.prosecdef = true
        AND n.nspname NOT IN ('pg_catalog', 'information_schema',
                              'extensions', 'pgsodium', 'pgsodium_masks',
                              'graphql', 'graphql_public', 'realtime',
                              'storage', 'vault', 'auth')
      ORDER BY n.nspname, p.proname;
    `);

    console.log(`\n📋 Functions com SECURITY DEFINER (${rows.length}):\n`);

    if (rows.length === 0) {
      console.log("✅ Nenhuma. RLS é respeitado em todo o app.");
      return;
    }

    for (const r of rows) {
      console.log(`─── ${r.schema}.${r.name}`);
      console.log(`    owner:    ${r.owner}`);
      console.log(`    language: ${r.language}`);
      console.log(`    config:   ${JSON.stringify(r.config)}`);
      console.log(`    prosrc:   ${r.prosrc_preview.replace(/\n/g, " ").slice(0, 200)}`);
      console.log("");
    }

    console.log("\n⚠️  Cada uma destas functions roda com privilégio do OWNER");
    console.log("    e BYPASSA RLS. Revisar:");
    console.log("    1. É realmente necessário SECURITY DEFINER?");
    console.log("    2. Há sanitização de input adequada?");
    console.log("    3. Há WHERE clauses que limitam scope (store_id, user_id)?");
    console.log("    4. Quem PODE chamar (GRANT EXECUTE)?");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Falhou:", e.message);
  process.exit(1);
});
