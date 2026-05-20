/**
 * Compara o que Drizzle DECLARA vs o que existe em PROD.
 * - Tabelas: presente nos dois? só Drizzle? só DB?
 * - Indexes: contagem por tabela
 * - Foreign keys: count e ON DELETE
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";

const url = process.env.DIRECT_URL;
const pool = new Pool({ connectionString: url });

// 1. Tabelas no Drizzle
const schemaFiles = readdirSync("src/db/schema").filter(f => f.endsWith(".ts") && f !== "index.ts");
const drizzleTables = new Set();
for (const f of schemaFiles) {
  const src = readFileSync(`src/db/schema/${f}`, "utf8");
  // Matches: pgTable("name", ... or pgTable(\n  "name",
  const matches = src.matchAll(/pgTable\(\s*"([a-z_]+)"/g);
  for (const m of matches) drizzleTables.add(m[1]);
}

// 2. Tabelas no DB
const r = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);
const dbTables = new Set(r.rows.map(x => x.table_name));

// 3. Diff
const onlyDrizzle = [...drizzleTables].filter(t => !dbTables.has(t));
const onlyDb = [...dbTables].filter(t => !drizzleTables.has(t));
const both = [...drizzleTables].filter(t => dbTables.has(t));

console.log("=== TABELAS ===");
console.log(`Drizzle declara: ${drizzleTables.size}`);
console.log(`DB tem:          ${dbTables.size}`);
console.log(`Em ambos:        ${both.length}`);
console.log("");
if (onlyDrizzle.length > 0) {
  console.log(`Só no Drizzle (não aplicada no DB):`);
  for (const t of onlyDrizzle) console.log(`  - ${t}`);
}
if (onlyDb.length > 0) {
  console.log(`Só no DB (sem schema Drizzle):`);
  for (const t of onlyDb) console.log(`  - ${t}`);
}

// 4. Indexes por tabela
const idx = await pool.query(`
  SELECT tablename, count(*) AS n
  FROM pg_indexes
  WHERE schemaname='public'
  GROUP BY tablename
  ORDER BY tablename
`);
console.log("\n=== INDEXES POR TABELA ===");
for (const row of idx.rows) {
  console.log(`  ${row.tablename.padEnd(34)} ${row.n}`);
}

// 5. Foreign keys + ON DELETE
const fk = await pool.query(`
  SELECT
    conrelid::regclass::text AS tbl_name,
    conname,
    pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE contype='f'
    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
  ORDER BY conrelid::regclass::text, conname
`);
console.log(`\n=== FOREIGN KEYS (${fk.rowCount}) ===`);
// Group by ON DELETE behavior
const onDeleteCount = { CASCADE: 0, "SET NULL": 0, "NO ACTION": 0, RESTRICT: 0 };
for (const row of fk.rows) {
  const def = row.def;
  if (def.includes("ON DELETE CASCADE")) onDeleteCount.CASCADE++;
  else if (def.includes("ON DELETE SET NULL")) onDeleteCount["SET NULL"]++;
  else if (def.includes("ON DELETE RESTRICT")) onDeleteCount.RESTRICT++;
  else onDeleteCount["NO ACTION"]++;
}
console.log("ON DELETE behavior:");
for (const [k, v] of Object.entries(onDeleteCount)) console.log(`  ${k.padEnd(12)} ${v}`);

await pool.end();
