/**
 * Apply a single .sql bundle to Supabase prod via DIRECT_URL.
 *
 * Usage: node scripts/apply-sql-bundle.mjs supabase/sql/BUNDLE_*.sql
 *
 * Rolls back on first error. Idempotent SQL (ADD COLUMN IF NOT EXISTS etc)
 * can be re-run safely.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/apply-sql-bundle.mjs <path-to-sql>");
  process.exit(1);
}

const sqlPath = resolve(target);
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  console.log(`→ Aplicando ${sqlPath}`);
  console.log(`→ ${sql.split("\n").length} linhas, ${sql.length} bytes`);
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("✅ COMMIT — bundle aplicado");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("❌ ROLLBACK — erro:");
  console.error(err.message);
  if (err.position) console.error(`position: ${err.position}`);
  if (err.detail) console.error(`detail: ${err.detail}`);
  if (err.hint) console.error(`hint: ${err.hint}`);
  process.exit(2);
} finally {
  client.release();
  await pool.end();
}
