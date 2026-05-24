// Auditoria limpa: só drift real.
// - Compara colunas TS vs DB (excluindo nomes que vêm da seção (t) => ({...}))
// - Compara indexes TS vs DB
// - Compara constraints TS vs DB
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readdirSync,readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

const directUrl = process.env.DIRECT_URL;
const client = new pg.Client({ connectionString: directUrl });
await client.connect();

// ---- DB real: colunas ----
const dbColsQ = await client.query(`
  select table_name, column_name, data_type
    from information_schema.columns
   where table_schema='public'
     and table_name in ('store','category','product','product_image','product_variant','banner','order','order_item','user','session','account','verification')
   order by table_name, ordinal_position
`);
const dbCols = {};
for (const r of dbColsQ.rows) (dbCols[r.table_name] ??= []).push(r.column_name);

// ---- DB real: indexes ----
const dbIdxQ = await client.query(`
  select tablename, indexname from pg_indexes
   where schemaname='public'
   order by tablename, indexname
`);
const dbIdx = {};
for (const r of dbIdxQ.rows) (dbIdx[r.tablename] ??= []).push(r.indexname);

// ---- DB real: constraints (uniques, fks, checks) ----
const dbConQ = await client.query(`
  select tc.table_name, tc.constraint_name, tc.constraint_type
    from information_schema.table_constraints tc
   where tc.table_schema='public' and tc.constraint_type in ('UNIQUE','CHECK','FOREIGN KEY')
   order by tc.table_name, tc.constraint_name
`);
const dbCon = {};
for (const r of dbConQ.rows) (dbCon[r.table_name] ??= []).push(r.constraint_name);

// ---- Schema TS: parse colunas (1º arg do pgTable) ----
const schemaDir = "src/db/schema";
const files = readdirSync(schemaDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");

const tsCols = {};
const tsExtras = {}; // o segundo arg (t) => ({ index/unique/etc })
for (const f of files) {
  const src = readFileSync(join(schemaDir, f), "utf8");
  // tabela = pgTable("name", { COLS_BLOCK }, OPTIONAL_EXTRAS_BLOCK )
  // Quebra simples: pega tudo entre o "name", e o próximo pgTable( ou fim do arquivo.
  const splits = src.split(/pgTable\(\s*"([^"]+)"\s*,/);
  for (let i = 1; i < splits.length; i += 2) {
    const tname = splits[i];
    const chunk = splits[i + 1] ?? "";
    // primeiro `{ ... }` é o bloco de colunas; depois pode ter `(t) => ({ ... })` com indexes/constraints
    // Encontra o fim do bloco de colunas: contagem de chaves
    let depth = 0,
      end = -1,
      start = -1;
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      if (c === "{") {
        if (start === -1) start = j;
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          end = j;
          break;
        }
      }
    }
    const colsBlock = start >= 0 && end > start ? chunk.slice(start + 1, end) : "";
    const extrasBlock = end >= 0 ? chunk.slice(end + 1) : "";

    const cols = [];
    const colRe = /^\s*\w+\s*:\s*\w+\(\s*"([^"]+)"/gm;
    let cm;
    while ((cm = colRe.exec(colsBlock))) cols.push(cm[1]);
    tsCols[tname] = cols;

    // pega nomes de index("..."), unique("..."), foreignKey({ name: "..."})
    const extras = new Set();
    const idxRe = /\b(index|uniqueIndex|unique)\(\s*"([^"]+)"/g;
    while ((cm = idxRe.exec(extrasBlock))) extras.add(cm[2]);
    tsExtras[tname] = [...extras];
  }
}

// ---- Diff colunas ----
console.log("\n=== DRIFT DE COLUNAS ===");
let anyColDrift = false;
for (const t of Object.keys(tsCols).sort()) {
  const ts = new Set(tsCols[t]);
  const db = new Set(dbCols[t] || []);
  const missingDb = [...ts].filter((c) => !db.has(c));
  const orphanDb = [...db].filter((c) => !ts.has(c));
  if (missingDb.length || orphanDb.length) {
    anyColDrift = true;
    console.log(`-- ${t} --`);
    if (missingDb.length) console.log(`  faltando em prod: ${missingDb.join(", ")}`);
    if (orphanDb.length)  console.log(`  órfão em prod   : ${orphanDb.join(", ")}`);
  }
}
if (!anyColDrift) console.log("✅ todas tabelas alinhadas a nível de COLUNA.");

// ---- Diff indexes/constraints (informativo, drizzle nem sempre nomeia igual) ----
console.log("\n=== DRIFT DE INDEXES / UNIQUES (informativo) ===");
const namedTsExtras = Object.keys(tsExtras).filter((t) => tsExtras[t].length);
let anyIdxDrift = false;
for (const t of namedTsExtras.sort()) {
  const tsNames = new Set(tsExtras[t]);
  const dbNames = new Set([...(dbIdx[t] || []), ...(dbCon[t] || [])]);
  const missing = [...tsNames].filter((n) => !dbNames.has(n));
  if (missing.length) {
    anyIdxDrift = true;
    console.log(`-- ${t} --  faltando em prod: ${missing.join(", ")}`);
  }
}
if (!anyIdxDrift) console.log("✅ indexes/uniques nomeados batem.");

await client.end();
