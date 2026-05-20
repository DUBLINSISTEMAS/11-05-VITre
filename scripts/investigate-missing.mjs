/**
 * Investigar SQLs 45 e 49 que vieram MISSING.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const url = process.env.DIRECT_URL;
const pool = new Pool({ connectionString: url });

console.log("=== SQL 45: purchase_item.total_in_cents ===");
const r45a = await pool.query(`
  SELECT column_name, is_generated, generation_expression, data_type
  FROM information_schema.columns
  WHERE table_name='purchase_item'
  ORDER BY ordinal_position
`);
console.log("Colunas de purchase_item:");
for (const row of r45a.rows) {
  console.log(`  ${row.column_name} (${row.data_type}) generated=${row.is_generated} expr=${row.generation_expression ?? "—"}`);
}

console.log("\n=== SQL 49: tabela brand ===");
const r49 = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name='brand'
`);
console.log(`brand table existe? ${r49.rowCount > 0 ? "SIM" : "NÃO"}`);

console.log("\n=== Listar todas tabelas em prod ===");
const rTables = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);
console.log(`Total: ${rTables.rowCount} tabelas`);
for (const row of rTables.rows) {
  console.log(`  ${row.table_name}`);
}

await pool.end();
