/**
 * One-shot: aplica SQL 71 (PP5) em prod usando DIRECT_URL.
 *
 * Por que script ad-hoc em vez de migration tool: o projeto não tem
 * migration framework (Drizzle é used em schema-first, SQL files são
 * aplicados manualmente). O check-sql-applied.mjs valida idempotência
 * via sentinelas no catálogo do Postgres.
 *
 * Defensivo: DROP CONSTRAINT IF EXISTS antes do ADD pra ser idempotente
 * em re-runs (ADD CONSTRAINT do Postgres não aceita IF NOT EXISTS).
 *
 * Transação única: se qualquer comando falhar, rollback total.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

const STATEMENTS = [
  `ALTER TABLE storefront_collection
     ADD COLUMN IF NOT EXISTS kicker text`,
  `ALTER TABLE storefront_collection
     ADD COLUMN IF NOT EXISTS bg_color text`,
  // Defesa idempotente — drops antes do add.
  `ALTER TABLE storefront_collection
     DROP CONSTRAINT IF EXISTS storefront_collection_bg_color_format`,
  `ALTER TABLE storefront_collection
     ADD CONSTRAINT storefront_collection_bg_color_format
     CHECK (
       bg_color IS NULL
       OR bg_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'
     )`,
  `ALTER TABLE storefront_collection
     DROP CONSTRAINT IF EXISTS storefront_collection_kicker_length`,
  `ALTER TABLE storefront_collection
     ADD CONSTRAINT storefront_collection_kicker_length
     CHECK (kicker IS NULL OR char_length(kicker) <= 30)`,
];

const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  console.log("→ Iniciando transação...");
  await client.query("BEGIN");

  for (const [i, stmt] of STATEMENTS.entries()) {
    const firstLine = stmt.trim().split("\n")[0];
    console.log(`  [${i + 1}/${STATEMENTS.length}] ${firstLine}...`);
    await client.query(stmt);
  }

  // Sanity check: confirma que kicker e bg_color existem.
  const colCheck = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'storefront_collection'
      AND column_name IN ('kicker', 'bg_color')
    ORDER BY column_name
  `);
  if (colCheck.rowCount !== 2) {
    throw new Error(
      `Esperava 2 colunas (kicker + bg_color), encontrou ${colCheck.rowCount}`,
    );
  }

  const conCheck = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (
      'storefront_collection_bg_color_format',
      'storefront_collection_kicker_length'
    )
    ORDER BY conname
  `);
  if (conCheck.rowCount !== 2) {
    throw new Error(
      `Esperava 2 constraints, encontrou ${conCheck.rowCount}`,
    );
  }

  await client.query("COMMIT");
  console.log("✅ SQL 71 aplicado com sucesso.");
  console.log(
    `   Colunas: ${colCheck.rows.map((r) => r.column_name).join(", ")}`,
  );
  console.log(
    `   Constraints: ${conCheck.rows.map((r) => r.conname).join(", ")}`,
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ FALHOU. Rollback feito.");
  console.error(err.message);
  process.exit(2);
} finally {
  client.release();
  await pool.end();
}
