/**
 * Roda scripts/wipe-dev-store.sql no DIRECT_URL e imprime os resultados.
 * O .sql termina em ROLLBACK — então nada é alterado de verdade.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const sql = await readFile("scripts/wipe-dev-store.sql", "utf8");
  const client = await pool.connect();
  try {
    const res = await client.query(sql);
    const list = Array.isArray(res) ? res : [res];

    let queryIdx = 0;
    for (const r of list) {
      if (!r || !r.rows || r.rows.length === 0) continue;
      queryIdx += 1;
      console.log(`\n--- Resultado #${queryIdx} ---`);
      console.table(r.rows);
    }
    console.log("\n✓ SQL executado. (Verifica se o arquivo termina em ROLLBACK ou COMMIT.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
