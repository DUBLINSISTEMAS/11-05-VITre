/**
 * Health check do banco — lista tabelas, enums e policies RLS.
 * Uso: `npm run db:check`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    throw new Error("DIRECT_URL ausente em .env.local");
  }

  const pool = new Pool({ connectionString: url });

  try {
    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const enums = await pool.query<{ typname: string; enumlabels: string }>(`
      SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enumlabels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      GROUP BY t.typname
      ORDER BY t.typname
    `);

    const policies = await pool.query<{ tablename: string; policy_count: string }>(`
      SELECT tablename, count(*)::text AS policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY tablename
    `);

    const rlsStatus = await pool.query<{ tablename: string; rls_enabled: boolean }>(`
      SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    console.log(`\n📊 Tabelas (${tables.rowCount}):`);
    for (const r of tables.rows) console.log(`  • ${r.table_name}`);

    console.log(`\n🏷  Enums (${enums.rowCount}):`);
    for (const r of enums.rows) console.log(`  • ${r.typname}: ${r.enumlabels}`);

    console.log(`\n🔒 RLS por tabela:`);
    for (const r of rlsStatus.rows) {
      const icon = r.rls_enabled ? "✅" : "❌";
      console.log(`  ${icon} ${r.tablename}`);
    }

    console.log(`\n📜 Policies RLS (${policies.rowCount} tabelas com policies):`);
    if (policies.rowCount === 0) {
      console.log("  ⚠️  Nenhuma policy ainda. Rode supabase/sql/01_rls_setup.sql no Supabase SQL Editor.");
    } else {
      for (const r of policies.rows) {
        console.log(`  • ${r.tablename}: ${r.policy_count} policies`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Falhou:", e.message);
  process.exit(1);
});
