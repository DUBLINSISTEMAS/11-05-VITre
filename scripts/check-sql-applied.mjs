/**
 * Auditoria read-only — verifica quais SQLs de supabase/sql/*.sql
 * estão aplicados em prod usando marcadores no catálogo do Postgres.
 *
 * Lê DIRECT_URL de .env.local. Nunca escreve no banco.
 * Uso: pnpm exec tsx scripts/check-sql-applied.mjs
 *
 * Cobertura: SQLs 11–43 (estruturais). SQLs 01–10 são bootstrap inicial
 * e SQL 17_cleanup / 99_cleanup são one-shot DELETE — sem auditoria.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const checks = [
  { id: "11",  desc: "index order_expires_awaiting", q: "SELECT 1 FROM pg_indexes WHERE indexname ILIKE '%order%expires%awaiting%'" },
  { id: "12",  desc: "CHECK phone E.164 + length", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%phone%e164%' OR conname ILIKE '%customer_phone%format%' OR conname ILIKE '%order%phone%length%'" },
  { id: "13",  desc: "index verification.identifier", q: "SELECT 1 FROM pg_indexes WHERE tablename='verification' AND indexdef ILIKE '%identifier%'" },
  { id: "14",  desc: "trigger category max-depth", q: "SELECT 1 FROM pg_trigger WHERE tgname ILIKE '%categor%depth%' OR tgname ILIKE '%categor%nest%'" },
  { id: "15",  desc: "revoke anon grants (anon NÃO tem SELECT em store)", q: "SELECT 1 FROM information_schema.role_table_grants WHERE grantee='anon' AND table_name='store' AND privilege_type='SELECT'", expectEmpty: true },
  { id: "16",  desc: "theme CHECK constraints (store_*_valid)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('store_category_shape_valid','store_product_card_style_valid','store_hero_style_valid')" },
  { id: "17",  desc: "payment CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%cash_discount%' OR conname ILIKE '%installments_max%'" },
  // 17_cleanup_orphan_drafts.sql e 99_cleanup_orphan_drafts.sql são scripts
  // one-shot DELETE — não criam objeto persistente. Sem auditoria.
  { id: "18",  desc: "product_related RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='product_related'" },
  { id: "19",  desc: "product cash_discount override CHECK", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%product%cash_discount%'" },
  { id: "20",  desc: "customer CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conrelid = 'customer'::regclass AND contype='c'" },
  { id: "21",  desc: "customer RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='customer'" },
  { id: "22",  desc: "stock_movement CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conrelid = 'stock_movement'::regclass AND contype='c'" },
  { id: "23",  desc: "stock_movement RLS policy", q: "SELECT 1 FROM pg_policies WHERE tablename='stock_movement'" },
  { id: "24",  desc: "stock_movement trigger sync cache", q: "SELECT 1 FROM pg_trigger WHERE tgname ILIKE '%stock%movement%' OR tgname ILIKE '%sync_stock%'" },
  // SQL 25 (backfill) é condicional: roda só se houver produto com track_stock+saldo>0.
  // Em prod limpo, INSERT 0 linhas é resultado correto — não auditado.
  { id: "26",  desc: "PDV CHECK constraints (Fase 5 — ADR-0016)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_balcao_requires_payment_method','order_discount_nonneg','order_cash_received_consistency','order_whatsapp_no_pos_fields') HAVING count(*) = 4" },
  { id: "27",  desc: "PDV surcharge dual (ADR-0020)", q: "SELECT 1 FROM pg_constraint WHERE conname ILIKE '%surcharge%'" },
  { id: "28",  desc: "customer document CHECK (PF/PJ — ADR-0021)", q: "SELECT 1 FROM pg_constraint WHERE conrelid='customer'::regclass AND (conname ILIKE '%document%' OR conname ILIKE '%customer_type%')" },
  { id: "29",  desc: "cash_session CHECK constraints", q: "SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('cash_session') AND contype='c'" },
  { id: "30",  desc: "store_business_hours_object CHECK (ADR-0023)", q: "SELECT 1 FROM pg_constraint WHERE conname='store_business_hours_object'" },
  { id: "31",  desc: "attributes RLS (ADR-0024)", q: "SELECT 1 FROM pg_policies WHERE tablename IN ('attribute','attribute_value','product_attribute_value') HAVING count(*) > 0" },
  { id: "32",  desc: "customer_groups RLS (ADR-0025)", q: "SELECT 1 FROM pg_policies WHERE tablename IN ('customer_group','customer_group_member') HAVING count(*) > 0" },
  { id: "33",  desc: "coupon RLS (ADR-0026)", q: "SELECT 1 FROM pg_policies WHERE tablename='coupon'" },
  { id: "34",  desc: "lead RLS (ADR-0027)", q: "SELECT 1 FROM pg_policies WHERE tablename='lead'" },
  { id: "35",  desc: "store_membership RLS (ADR-0029)", q: "SELECT 1 FROM pg_policies WHERE tablename='store_membership'" },
  { id: "36",  desc: "FORCE RLS consistency (customer/product_related/stock_movement)", q: "SELECT 1 FROM pg_class WHERE relname IN ('product_related','stock_movement','customer') AND relrowsecurity AND relforcerowsecurity HAVING count(*) = 3" },
  { id: "37",  desc: "product_image RLS active-only (auditoria C4 — 2026-05-18)", q: "SELECT 1 FROM pg_policies WHERE tablename='product_image' AND policyname='product_image_public_read_active'" },
  { id: "38",  desc: "order_whatsapp_no_pos_fields inclui surcharge (auditoria C5 — 2026-05-18)", q: "SELECT 1 FROM pg_constraint WHERE conname='order_whatsapp_no_pos_fields' AND pg_get_constraintdef(oid) ILIKE '%surcharge_in_cents IS NULL%'" },
  { id: "39",  desc: "storefront_collection RLS (renomeado de 36_*)", q: "SELECT 1 FROM pg_policies WHERE tablename='storefront_collection'" },
  { id: "40",  desc: "coupon uses<=max CHECK defensivo (S5 — 2026-05-18)", q: "SELECT 1 FROM pg_constraint WHERE conname='coupon_uses_within_max'" },
  { id: "41",  desc: "lead_anon_insert hardened com store ativa (S4 — 2026-05-19)", q: "SELECT 1 FROM pg_policies WHERE tablename='lead' AND policyname='lead_anon_insert' AND with_check ILIKE '%is_active%'" },
  { id: "42",  desc: "DROP order_anonymous_insert policy redundante (A3 — 2026-05-19)", q: "SELECT 1 FROM pg_policies WHERE tablename='order' AND policyname='order_anonymous_insert'", expectEmpty: true },
  { id: "43",  desc: "sync_stock trigger respeita track_stock (Onda C #8 — 2026-05-19)", q: "SELECT 1 FROM pg_proc WHERE proname='sync_stock_cache_on_movement' AND prosrc ILIKE '%track_stock%'" },
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
