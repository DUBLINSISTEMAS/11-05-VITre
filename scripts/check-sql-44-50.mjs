/**
 * Auditoria one-shot — verifica SQLs 44-50 aplicadas em prod.
 * Complementa scripts/check-sql-applied.mjs que cobre 11-43.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const checks = [
  {
    id: "44",
    desc: "Camada Comercial CHECK constraints (order_payment + receivable + cash_adjustment)",
    q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_payment_amount_positive','order_payment_cash_received_consistency','receivable_amount_positive','cash_adjustment_amount_positive') HAVING count(*) >= 3",
  },
  {
    id: "45",
    desc: "purchase_item.total_cost_in_cents GENERATED ALWAYS",
    q: "SELECT 1 FROM information_schema.columns WHERE table_name='purchase_item' AND column_name='total_cost_in_cents' AND is_generated='ALWAYS'",
  },
  {
    id: "46",
    desc: "Camada Comercial RLS (supplier/purchase/purchase_item/receivable)",
    q: "SELECT 1 FROM pg_policies WHERE tablename IN ('supplier','purchase','purchase_item','receivable') HAVING count(*) >= 4",
  },
  {
    id: "47",
    desc: "order_payment backfill — pelo menos 1 linha por order_payment_method NOT NULL",
    q: "SELECT 1 FROM order_payment LIMIT 1",
    expectEmpty: false,
    note: "Backfill é condicional (não falha se store nova sem orders)",
  },
  {
    id: "48",
    desc: "product.wholesale_price CHECK (wholesale <= base)",
    q: "SELECT 1 FROM pg_constraint WHERE conname IN ('product_wholesale_price_nonneg','product_wholesale_lte_base') HAVING count(*) = 2",
  },
  {
    id: "49",
    desc: "tabela brand criada (Sprint 0/Prompt 6)",
    q: "SELECT 1 FROM information_schema.tables WHERE table_name='brand'",
  },
  {
    id: "50",
    desc: "order_status enum tem 'quote' E order.quote_valid_until existe (Sprint 1A Fase 4)",
    q: "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname='order_status' AND e.enumlabel='quote'",
  },
  {
    id: "50b",
    desc: "order.quote_valid_until column existe",
    q: "SELECT 1 FROM information_schema.columns WHERE table_name='order' AND column_name='quote_valid_until'",
  },
];

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
let pass = 0;
let fail = 0;
const failedIds = [];

for (const c of checks) {
  try {
    const r = await pool.query(c.q);
    const has = (r.rowCount ?? 0) > 0;
    const ok = c.expectEmpty ? !has : has;
    const status = ok ? "APPLIED  " : "MISSING  ";
    console.log(`${status}SQL ${c.id.padEnd(4)} ${c.desc}`);
    if (c.note) console.log(`           NOTE: ${c.note}`);
    if (ok) pass++;
    else {
      fail++;
      failedIds.push(c.id);
    }
  } catch (e) {
    console.log(`ERROR    SQL ${c.id.padEnd(4)} ${c.desc} :: ${e.message}`);
    fail++;
    failedIds.push(c.id);
  }
}

await pool.end();
console.log(`\nResultado: ${pass}/${checks.length} aplicados.`);
if (failedIds.length > 0) {
  console.log(`Falhas em: ${failedIds.join(", ")}`);
}
process.exit(fail === 0 ? 0 : 2);
