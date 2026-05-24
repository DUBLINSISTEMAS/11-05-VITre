/**
 * Sprint 6D — IDOR smoke test.
 *
 * Verifica que RLS bloqueia acesso cross-tenant em tabelas críticas.
 * Simula um "atacante" autenticado como `vitre_app` que conhece UM
 * store_id (próprio fake) e tenta ler/modificar dados de outra loja.
 *
 * Categorização:
 *   PRIVATE: dado sensível (orders, customers, financeiro). RLS DEVE
 *            isolar — atacante com store_id fake vê 0 rows.
 *   PUBLIC : dado intencionalmente legível por anônimo (storefront —
 *            ADR-0008). policy `public_read_active` permite is_active=true.
 *            Smoke valida que SÓ retorna itens ativos (drafts ficam
 *            escondidos).
 *
 * Sucesso = todas as PRIVATE retornam 0 rows + todas as PUBLIC só
 * retornam itens ativos.
 *
 * Uso: `node --env-file=.env.local scripts/smoke-idor.mjs`
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { Pool } from "pg";

const ATTACKER_FAKE_STORE = randomUUID();

/** Tabelas com dado sensível — RLS DEVE bloquear cross-tenant. */
const PRIVATE_TABLES = [
  '"order"',
  "order_item",
  "order_payment",
  "order_return",
  "order_return_item",
  "customer",
  "customer_group",
  "receivable",
  "receivable_payment",
  "cash_session",
  "cash_adjustment",
  "stock_movement",
  "supplier",
  "purchase",
  "purchase_item",
  "audit_event",
  "lead",
  "coupon",
];

/**
 * Tabelas com leitura pública intencional (storefront — ADR-0008).
 * Smoke valida que SÓ retornam items ativos.
 */
const PUBLIC_READ_TABLES = [
  { name: "store", activeColumn: "is_active" },
  { name: "product", activeColumn: "is_active" },
  { name: "product_variant", activeColumn: "is_active" },
  { name: "category", activeColumn: "is_active" },
  { name: "banner", activeColumn: "is_active" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ausente em .env.local (precisa de vitre_app — não bypass).",
    );
  }

  const pool = new Pool({ connectionString: url });
  let allOk = true;
  const findings = [];

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_store_id', $1, true)`, [
        ATTACKER_FAKE_STORE,
      ]);
      await client.query(
        `SELECT set_config('app.current_user_id', 'idor-attacker', true)`,
      );

      console.log(`\n🔐 IDOR smoke test`);
      console.log(`   Attacker fake store_id: ${ATTACKER_FAKE_STORE}\n`);

      console.log("─── PRIVATE (RLS deve bloquear)");
      for (const tbl of PRIVATE_TABLES) {
        try {
          const r = await client.query(`SELECT * FROM ${tbl} LIMIT 5`);
          const rowCount = r.rowCount ?? 0;
          const ok = rowCount === 0;
          if (!ok) {
            allOk = false;
            findings.push(`PRIVATE ${tbl}: ${rowCount} rows vazadas`);
          }
          console.log(
            `${ok ? "✅" : "❌"} ${tbl.padEnd(28)} ${rowCount} rows ${ok ? "" : "← VAZAMENTO"}`,
          );
        } catch (err) {
          // RLS policy violation legítimo é ok.
          console.log(
            `⚠️  ${tbl.padEnd(28)} erro: ${(err.message?.split("\n")[0] ?? "").slice(0, 60)}`,
          );
        }
      }

      console.log(`\n─── PUBLIC (só items ativos — ADR-0008)`);
      for (const { name, activeColumn } of PUBLIC_READ_TABLES) {
        try {
          const r = await client.query(`SELECT * FROM ${name}`);
          const rowCount = r.rowCount ?? 0;
          const inactive = r.rows.filter((row) => row[activeColumn] === false);
          const ok = inactive.length === 0;
          if (!ok) {
            allOk = false;
            findings.push(`PUBLIC ${name}: ${inactive.length} drafts vazadas`);
          }
          console.log(
            `${ok ? "✅" : "❌"} ${name.padEnd(20)} ${rowCount} total / ${inactive.length} inativos ${ok ? "" : "← DRAFT VAZADO"}`,
          );
        } catch (err) {
          console.log(
            `⚠️  ${name.padEnd(20)} erro: ${(err.message?.split("\n")[0] ?? "").slice(0, 60)}`,
          );
        }
      }

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  console.log(`\n${"─".repeat(60)}`);
  if (allOk) {
    console.log("✅ TODAS as tabelas isoladas — sem IDOR detectável.");
    console.log("   PRIVATE: 0 rows. PUBLIC: só items ativos (intencional).");
    process.exit(0);
  } else {
    console.log("❌ VAZAMENTO detectado:");
    for (const f of findings) console.log(`   ${f}`);
    console.log("\n   Revisar policies dessas tabelas IMEDIATAMENTE.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Smoke falhou:", e.message);
  process.exit(1);
});
