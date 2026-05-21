/**
 * Lista todas as FKs que apontam pra store/order/product/customer/etc.
 * Mostra se têm ON DELETE CASCADE ou se vão exigir DELETE explícito antes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  try {
    const fks = await pool.query(`
      SELECT
        tc.table_name AS child_table,
        kcu.column_name AS child_column,
        ccu.table_name AS parent_table,
        ccu.column_name AS parent_column,
        rc.delete_rule AS on_delete
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_schema = 'public'
      ORDER BY parent_table, child_table
    `);

    console.log("=== FKs em public.* (filhas → pais) ===");
    console.log("RULE  CHILD.column  →  PARENT.column");
    console.log("-".repeat(80));
    let lastParent = "";
    for (const r of fks.rows) {
      if (r.parent_table !== lastParent) {
        console.log(`\n→ PAI: ${r.parent_table}`);
        lastParent = r.parent_table;
      }
      const ruleColor = r.on_delete === "CASCADE" ? "✓" : "✗";
      console.log(
        `  ${ruleColor} ${r.on_delete.padEnd(8)} ${r.child_table}.${r.child_column}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
