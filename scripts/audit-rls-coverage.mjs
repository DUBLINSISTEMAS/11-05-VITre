/**
 * Auditoria RLS — read-only.
 * Lista cada tabela do schema public e informa:
 *   - rowsecurity (RLS habilitada?)
 *   - forcerowsecurity (FORCE — owner do schema NÃO pula RLS?)
 *   - count de policies
 *   - grants pra anon e authenticated
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const url = process.env.DIRECT_URL;
const pool = new Pool({ connectionString: url });

const r = await pool.query(`
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname='public') AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname='public'
    AND c.relkind='r'
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY c.relname
`);

const anonGrants = await pool.query(`
  SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE grantee='anon' AND table_schema='public'
  GROUP BY table_name
  ORDER BY table_name
`);
const anonByTable = new Map(anonGrants.rows.map(r => [r.table_name, r.privs]));

const authGrants = await pool.query(`
  SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE grantee='authenticated' AND table_schema='public'
  GROUP BY table_name
  ORDER BY table_name
`);
const authByTable = new Map(authGrants.rows.map(r => [r.table_name, r.privs]));

console.log("table_name".padEnd(34) + "RLS  FORCE  POL  anon                authenticated");
console.log("-".repeat(110));

const concerns = [];
for (const t of r.rows) {
  const anon = anonByTable.get(t.table_name) ?? "—";
  const auth = authByTable.get(t.table_name) ?? "—";
  const rls = t.rls_enabled ? "Y" : "N";
  const force = t.rls_forced ? "Y" : "N";
  const pol = String(t.policy_count).padStart(2);
  console.log(
    t.table_name.padEnd(34) +
    rls.padEnd(5) + force.padEnd(7) + pol.padEnd(5) +
    anon.padEnd(20) + auth,
  );

  // Flags
  if (!t.rls_enabled) concerns.push(`${t.table_name}: RLS DESABILITADA`);
  if (t.rls_enabled && t.policy_count === 0) concerns.push(`${t.table_name}: RLS habilitada mas SEM POLICIES (bloqueia tudo)`);
  if (anon !== "—" && anon.includes("INSERT") && !anon.includes("SELECT")) {
    // anon com INSERT mas sem SELECT = público pode escrever mas não ler (storefront pattern, OK)
  }
}

console.log("\n=== CONCERNS ===");
if (concerns.length === 0) {
  console.log("Nenhum concern automático identificado.");
} else {
  for (const c of concerns) console.log("- " + c);
}

await pool.end();
