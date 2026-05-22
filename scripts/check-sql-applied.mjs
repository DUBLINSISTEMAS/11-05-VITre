/**
 * Auditoria read-only — verifica quais SQLs de supabase/sql/*.sql
 * estão aplicados em prod usando marcadores no catálogo do Postgres.
 *
 * Lê DIRECT_URL de .env.local. Nunca escreve no banco.
 * Uso: pnpm exec tsx scripts/check-sql-applied.mjs
 *
 * Cobertura: SQLs 11–56 (estruturais). SQLs 01–10 são bootstrap inicial
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
  // SQL 26 criou 4 CHECKs. SQL 57 dropou `order_balcao_requires_payment_method`
  // (obsoleto desde Sprint 1A multipayment — fiado/orçamento legitimamente
  // gravam payment_method=null). Sentinela aqui valida os 3 que sobreviveram.
  { id: "26",  desc: "PDV CHECK constraints sobreviventes (Fase 5 — ADR-0016 + SQL 57)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_discount_nonneg','order_cash_received_consistency','order_whatsapp_no_pos_fields') HAVING count(*) = 3" },
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
  // ADR-0034 Camada Comercial — SQLs 44-48 (Camadas 1-2)
  { id: "44a", desc: "product cost/stock/gtin/ncm/commission CHECKs (ADR-0034 Camada 1)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('product_cost_price_nonneg','product_min_stock_nonneg','product_max_stock_nonneg','product_max_gte_min','product_gtin_format','product_ncm_format','product_commission_bps_range') HAVING count(*) = 7" },
  { id: "44b", desc: "product (store,gtin) e (store,internal_code) UNIQUE parciais", q: "SELECT 1 FROM pg_indexes WHERE indexname IN ('product_store_gtin_unique','product_store_internal_code_unique') HAVING count(*) = 2" },
  { id: "44c", desc: "order_item unit_cost_snapshot CHECK nonneg", q: "SELECT 1 FROM pg_constraint WHERE conname = 'order_item_unit_cost_snapshot_nonneg'" },
  { id: "44d", desc: "order_payment amount_positive + cash_received_consistent", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_payment_amount_positive','order_payment_cash_received_consistent') HAVING count(*) = 2" },
  { id: "44e", desc: "supplier document/state/zip CHECKs", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('supplier_document_format','supplier_state_format','supplier_zip_format') HAVING count(*) = 3" },
  { id: "44f", desc: "purchase total_nonneg + payment_method_when_paid", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('purchase_total_nonneg','purchase_payment_method_when_paid') HAVING count(*) = 2" },
  { id: "44g", desc: "purchase_item quantity_positive + unit_cost_nonneg", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('purchase_item_quantity_positive','purchase_item_unit_cost_nonneg') HAVING count(*) = 2" },
  { id: "44h", desc: "receivable amount_positive + paid_method_when_paid", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('receivable_amount_positive','receivable_paid_method_when_paid') HAVING count(*) = 2" },
  { id: "45",  desc: "purchase_item.total_cost_in_cents é GENERATED STORED", q: "SELECT 1 FROM information_schema.columns WHERE table_name='purchase_item' AND column_name='total_cost_in_cents' AND is_generated='ALWAYS'" },
  { id: "46",  desc: "RLS em order_payment/supplier/purchase/purchase_item/receivable (Camada 1)", q: "SELECT 1 FROM pg_policies WHERE tablename IN ('order_payment','supplier','purchase','purchase_item','receivable') HAVING count(*) >= 5" },
  { id: "47",  desc: "order_payment backfill: linhas == orders com payment_method NOT NULL", q: "SELECT 1 WHERE (SELECT COUNT(*) FROM \"order\" WHERE payment_method IS NOT NULL) = (SELECT COUNT(DISTINCT order_id) FROM \"order_payment\")" },
  { id: "48",  desc: "product wholesale_price CHECKs (nonneg + lte_base, ADR-0034 Camada 2)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('product_wholesale_price_nonneg','product_wholesale_lte_base') HAVING count(*) = 2" },
  // Sprint 1A + Sprint 2A — SQLs 49-52
  { id: "49",  desc: "brand table existe com RLS forced (Sprint 2)", q: "SELECT 1 FROM pg_class WHERE relname='brand' AND relrowsecurity=true AND relforcerowsecurity=true" },
  { id: "50a", desc: "enum order_status inclui 'quote' (Sprint 1A Fase 4)", q: "SELECT 1 FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='order_status') AND enumlabel='quote'" },
  { id: "50b", desc: "order.quote_valid_until column existe", q: "SELECT 1 FROM information_schema.columns WHERE table_name='order' AND column_name='quote_valid_until'" },
  { id: "51a", desc: "product.brand_id FK column existe (Sprint 2A)", q: "SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='brand_id'" },
  { id: "51b", desc: "product_brand_idx index existe", q: "SELECT 1 FROM pg_indexes WHERE indexname='product_brand_idx'" },
  { id: "52",  desc: "stock_movement aceita reference_type='purchase' (Sprint 3)", q: "SELECT 1 FROM pg_constraint WHERE conname='stock_movement_reference_consistency' AND pg_get_constraintdef(oid) ILIKE '%purchase%'" },
  // Sprint 4A + Pre-Sprint-6 B/C — SQLs 53-55
  { id: "53",  desc: "receivable_payment table existe com RLS forced (Sprint 4A)", q: "SELECT 1 FROM pg_class WHERE relname='receivable_payment' AND relrowsecurity=true AND relforcerowsecurity=true" },
  { id: "54a", desc: "receivable_payment amount_nonzero CHECK (permite reversal negativo)", q: "SELECT 1 FROM pg_constraint WHERE conname='receivable_payment_amount_nonzero'" },
  { id: "54b", desc: "receivable_payment.reversal_of_id column + FK", q: "SELECT 1 FROM information_schema.columns WHERE table_name='receivable_payment' AND column_name='reversal_of_id'" },
  { id: "54c", desc: "receivable_payment_reversal_unique (defesa double-reversal)", q: "SELECT 1 FROM pg_indexes WHERE indexname='receivable_payment_reversal_unique'" },
  { id: "55a", desc: "enum order_status inclui 'returned' (Pre-Sprint-6 C)", q: "SELECT 1 FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='order_status') AND enumlabel='returned'" },
  { id: "55b", desc: "order_return + order_return_item com RLS forced", q: "SELECT 1 FROM pg_class WHERE relname IN ('order_return','order_return_item') AND relrowsecurity=true AND relforcerowsecurity=true HAVING count(*) = 2" },
  // Sprint 6A — SQL 56
  { id: "56",  desc: "audit_event table com RLS forced (Sprint 6A)", q: "SELECT 1 FROM pg_class WHERE relname='audit_event' AND relrowsecurity=true AND relforcerowsecurity=true" },
  // PDV fix 2026-05-20 — SQL 57 (sentinela de não-regressão)
  { id: "57",  desc: "SQL 57 dropou order_balcao_requires_payment_method (orçamento/fiado)", q: "SELECT 1 FROM pg_constraint WHERE conname='order_balcao_requires_payment_method'", expectEmpty: true },
  // Onda 1+2 — SQLs 58-63 (2026-05-21/22)
  { id: "58",  desc: "lead_anon_insert restrito a anonymous user (Fase 2 Bloco 2)", q: "SELECT 1 FROM pg_policies WHERE tablename='lead' AND policyname='lead_anon_insert' AND with_check ILIKE '%current_user_id%' AND with_check ILIKE '%anonymous%'" },
  { id: "59",  desc: "order_item discount CHECK constraints (>=0 e <= price*qty)", q: "SELECT 1 FROM pg_constraint WHERE conname IN ('order_item_discount_nonneg','order_item_discount_not_above_line') HAVING count(*) = 2" },
  { id: "60",  desc: "stock_movement trigger SECURITY DEFINER (Onda 1.1)", q: "SELECT 1 FROM pg_proc WHERE proname='sync_stock_cache_on_movement' AND prosecdef = true" },
  { id: "61",  desc: "product_unit enum aceita 'par' e 'duzia' (Onda 2.10)", q: "SELECT 1 FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='product_unit') AND enumlabel IN ('par','duzia') HAVING count(*) = 2" },
  { id: "62",  desc: "product.allow_oversell column (Onda 2.15)", q: "SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='allow_oversell'" },
  { id: "63",  desc: "store.document column (Onda 2.7)", q: "SELECT 1 FROM information_schema.columns WHERE table_name='store' AND column_name='document'" },
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
