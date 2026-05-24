/**
 * Lista CHECK constraints + triggers da tabela order — pra encontrar regra
 * que possa estar barrando INSERT de quote ou fiado silenciosamente.
 */
import "dotenv/config";

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
try {
  const { rows } = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = '"order"'::regclass
      AND contype = 'c'
    ORDER BY conname;
  `);
  console.log(`\n=== CHECK constraints em "order" (${rows.length}) ===\n`);
  for (const r of rows) {
    console.log(r.conname);
    console.log("  " + r.def);
  }

  console.log("\n=== TRIGGERS em order ===\n");
  const { rows: triggers } = await pool.query(`
    SELECT trigger_name, event_manipulation, action_timing,
           action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'order'
    ORDER BY trigger_name;
  `);
  if (triggers.length === 0) {
    console.log("(nenhum)");
  }
  for (const t of triggers) {
    console.log(`${t.trigger_name}  ${t.action_timing} ${t.event_manipulation}`);
    console.log(`  ${t.action_statement}`);
  }
} finally {
  await pool.end();
}
