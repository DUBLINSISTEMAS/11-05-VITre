/**
 * Aplica um arquivo .sql arbitrário no banco via DIRECT_URL.
 * Uso: `tsx scripts/apply-sql.ts caminho/para/arquivo.sql`
 *
 * Útil para SQL que não vai pelo drizzle-kit (custom migrations,
 * setup de buckets, RLS policies).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: tsx scripts/apply-sql.ts <arquivo.sql>");
    process.exit(1);
  }

  const url = process.env.DIRECT_URL;
  if (!url) {
    throw new Error("DIRECT_URL ausente em .env.local");
  }

  const fullPath = resolve(process.cwd(), file);
  const sql = await readFile(fullPath, "utf8");

  console.log(`📄 Aplicando ${file}...`);

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log("✅ Aplicado com sucesso.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Falhou:", e.message);
  process.exit(1);
});
