/**
 * Inspeciona policies de RLS por tabela.
 * Uso: node --env-file=.env.local scripts/inspect-policies.mjs <tabela> [<tabela>...]
 */
import "dotenv/config";

import { Pool } from "pg";

const tables = process.argv.slice(2);
if (tables.length === 0) {
  console.error("Uso: node ... scripts/inspect-policies.mjs <tabela> [...]");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
try {
  const { rows } = await pool.query(
    `
      SELECT
        pp.schemaname, pp.tablename, pp.policyname, pp.permissive,
        pp.roles, pp.cmd,
        pg_get_expr(p.polqual, p.polrelid) AS using_expr,
        pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
      FROM pg_policies pp
      JOIN pg_policy p ON p.polname = pp.policyname
      JOIN pg_class c ON c.oid = p.polrelid AND c.relname = pp.tablename
      WHERE pp.tablename = ANY($1::text[])
      ORDER BY pp.tablename, pp.policyname
    `,
    [tables],
  );
  for (const r of rows) {
    console.log(`\n${r.tablename}.${r.policyname} (${r.cmd}, ${r.permissive})`);
    console.log(`  roles:  ${r.roles}`);
    console.log(`  using:  ${r.using_expr ?? "-"}`);
    console.log(`  check:  ${r.check_expr ?? "-"}`);
  }
} finally {
  await pool.end();
}
