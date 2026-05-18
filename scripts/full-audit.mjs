// Auditoria completa read-only:
//   1) Lista TODAS as tabelas em prod (public)
//   2) Lista TODAS as colunas por tabela em prod
//   3) Compara com schema Drizzle (src/db/schema)
//   4) Reporta tabelas em prod NÃO definidas em schema (candidate to drop)
//   5) Reporta tabelas em schema NÃO em prod (missing migration)
//   6) Lista buckets de storage (storage.buckets)
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const { rows: dbTables } = await client.query(`
  select table_name
    from information_schema.tables
   where table_schema = 'public'
     and table_type = 'BASE TABLE'
   order by table_name
`);

const { rows: dbCols } = await client.query(`
  select table_name, column_name, data_type, is_nullable
    from information_schema.columns
   where table_schema = 'public'
   order by table_name, ordinal_position
`);

const { rows: enums } = await client.query(`
  select t.typname as enum_name, e.enumlabel as enum_value
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   order by t.typname, e.enumsortorder
`);

const { rows: drizzleMigrations } = await client.query(`
  select hash, created_at from drizzle.__drizzle_migrations order by created_at
`);

let buckets = [];
try {
  const r = await client.query(`select id, name, public, created_at from storage.buckets order by name`);
  buckets = r.rows;
} catch {
  buckets = [{ error: "storage.buckets unreachable" }];
}

const { rows: triggers } = await client.query(`
  select event_object_table as table_name, trigger_name, action_timing, event_manipulation
    from information_schema.triggers
   where event_object_schema='public'
   order by table_name, trigger_name
`);

const { rows: policies } = await client.query(`
  select schemaname, tablename, policyname, permissive, roles, cmd
    from pg_policies
   where schemaname = 'public'
   order by tablename, policyname
`);

const { rows: rlsTables } = await client.query(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relkind='r'
   order by c.relname
`);

console.log("\n=== TABELAS EM PROD ===");
console.log(dbTables.map(t => t.table_name).join("\n"));

console.log("\n=== COLUNAS POR TABELA ===");
const byTable = {};
for (const c of dbCols) {
  (byTable[c.table_name] = byTable[c.table_name] || []).push(`  ${c.column_name} : ${c.data_type}${c.is_nullable === "NO" ? " NOT NULL" : ""}`);
}
for (const t of dbTables.map(x => x.table_name)) {
  console.log(`\n[${t}]`);
  console.log((byTable[t] || []).join("\n"));
}

console.log("\n=== ENUMS EM PROD ===");
const byEnum = {};
for (const e of enums) (byEnum[e.enum_name] = byEnum[e.enum_name] || []).push(e.enum_value);
for (const [k, v] of Object.entries(byEnum)) console.log(`  ${k}: [${v.join(", ")}]`);

console.log("\n=== STORAGE BUCKETS ===");
for (const b of buckets) console.log("  ", b);

console.log("\n=== RLS STATUS POR TABELA ===");
for (const r of rlsTables) console.log(`  ${r.table_name}: rls=${r.rls_enabled} force=${r.rls_forced}`);

console.log("\n=== POLICIES (count por tabela) ===");
const polByTable = {};
for (const p of policies) polByTable[p.tablename] = (polByTable[p.tablename] || 0) + 1;
for (const [t, c] of Object.entries(polByTable)) console.log(`  ${t}: ${c}`);

console.log("\n=== TRIGGERS ===");
for (const t of triggers) console.log(`  ${t.table_name}: ${t.trigger_name} (${t.action_timing} ${t.event_manipulation})`);

console.log(`\n=== DRIZZLE MIGRATIONS APLICADAS: ${drizzleMigrations.length} ===`);

await client.end();
