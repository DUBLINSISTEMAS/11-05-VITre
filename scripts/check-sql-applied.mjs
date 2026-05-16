/**
 * Auditoria read-only — verifica quais SQLs de supabase/sql/*.sql
 * estão aplicados em prod usando marcadores no catálogo do Postgres.
 *
 * Lê DIRECT_URL de .env.local. Nunca escreve no banco.
 * Uso: pnpm exec tsx scripts/check-sql-applied.mjs
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const checks = [
  { id: "11", desc: "index order_expires_awaiting", q: "SELECT 1 FROM pg_indexes WHERE indexname ILIKE '%order%expires%awaiting%'" },
  { id: "12", desc: "CHECK phone E.164 + length", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%phone%e164%' OR conname ILIKE '%customer_phone%format%' OR conname ILIKE '%order%phone%length%'" },
  { id: "13", desc: "index verification.identifier", q: "SELECT 1 FROM pg_indexes WHERE tablename='verification' AND indexdef ILIKE '%identifier%'" },
  { id: "14", desc: "trigger category max-depth", q: "SELECT 1 FROM pg_trigger WHERE tgname ILIKE '%categor%depth%' OR tgname ILIKE '%categor%nest%'" },
  { id: "15", desc: "revoke anon grants (anon NÃO tem SELECT em store)", q: "SELECT 1 FROM information_schema.role_table_grants WHERE grantee='anon' AND table_name='store' AND privilege_type='SELECT'", expectEmpty: true },
  { id: "16", desc: "theme CHECK constraints (store_*_valid)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('store_category_shape_valid','store_product_card_style_valid','store_hero_style_valid')" },
  { id: "17p", desc: "payment CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%cash_discount%' OR conname ILIKE '%installments_max%'" },
  // 17_cleanup_orphan_drafts.sql é um script de manutenção one-shot (DELETE),
  // não cria função/objeto persistente — não precisa ser auditado.
  { id: "18", desc: "product_related RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='product_related'" },
  { id: "19", desc: "product cash_discount override CHECK", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%product%cash_discount%'" },
  { id: "20", desc: "customer CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conrelid = 'customer'::regclass AND contype='c'" },
  { id: "21", desc: "customer RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='customer'" },
  { id: "22", desc: "stock_movement CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conrelid = 'stock_movement'::regclass AND contype='c'" },
  { id: "23", desc: "stock_movement RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='stock_movement'" },
  { id: "24", desc: "stock_movement trigger sync cache", q: "SELECT 1 FROM pg_trigger WHERE tgname ILIKE '%stock%movement%' OR tgname ILIKE '%sync_stock%'" },
  { id: "25", desc: "stock_movement backfill (linha initial)", q: "SELECT 1 FROM stock_movement WHERE movement_type='initial' LIMIT 1" },
  { id: "26", desc: "PDV CHECK constraints (Fase 5 — ADR-0016)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_balcao_requires_payment_method','order_discount_nonneg','order_cash_received_consistency','order_whatsapp_no_pos_fields') HAVING count(*) = 4" },
];

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL ausente em .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
let pass = 0;
let fail = 0;

for (const c of checks) {
  try {
    const r = await pool.query(c.q);
    const has = (r.rowCount ?? 0) > 0;
    const ok = c.expectEmpty ? !has : has;
    const status = ok ? "✅ APPLIED" : "❌ MISSING";
    console.log(`${status}  SQL ${c.id.padEnd(4)} ${c.desc}`);
    if (ok) pass++;
    else fail++;
  } catch (e) {
    console.log(`⚠️  ERROR   SQL ${c.id.padEnd(4)} ${c.desc} :: ${e.message}`);
    fail++;
  }
}

await pool.end();
console.log(`\nResultado: ${pass}/${checks.length} aplicados.`);
process.exit(fail === 0 ? 0 : 2);
