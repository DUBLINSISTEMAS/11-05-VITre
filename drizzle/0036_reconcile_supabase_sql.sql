-- =====================================================================
-- Mangos Pay — Onda 1.5 (2026-05-28): reconciliação drizzle ↔ supabase
-- =====================================================================
-- CONTEXTO
-- Drift histórico documentado em drizzle/0033_order_item_discount.sql:
-- desde 2026-05-21 várias colunas vivem APENAS em supabase/sql/* (aplicadas
-- manualmente no painel Supabase) sem nunca passarem por drizzle-kit
-- generate. Em prod funciona; em CI / DB virgem / novo dev rodando
-- `drizzle-kit migrate` o schema TS referencia colunas que não existem.
--
-- Esta migration consolida tudo que estava em supabase/sql/70-82 em UMA
-- migration drizzle idempotente (IF NOT EXISTS em colunas/tabelas/enums,
-- DROP CONSTRAINT IF EXISTS antes de ADD CONSTRAINT). Pode rodar em:
--   - prod (já tem tudo) → no-op puro;
--   - DB virgem (CI/local) → cria tudo do zero.
--
-- COBERTURA
--   SQL 70 — order_payment.installments + 2 CHECKs
--   SQL 71 — storefront_collection.kicker + bg_color + 2 CHECKs
--   SQL 72 — store.card_interest_free_up_to + CHECK range
--   SQL 73 — store.max_products_count + max_image_mb + 2 CHECKs
--   SQL 74 — product.weight_grams + CHECK range
--   SQL 75 — expense table + expense_category enum + RLS + GRANT
--   SQL 76 — store.card_real_fee_bps_{debit,credit_1x,credit_2x_to_6x,
--            credit_7x_to_12x} + CHECK range
--   SQL 77 — product_variant.cost_price_in_cents + CHECK nonneg
--   SQL 78 — store.receivable_default_late_fee_bps + _interest_bps,
--            receivable.late_fee_bps + interest_per_month_bps + CHECKs
--   SQL 79 — purchase_item.batch_number + expires_at + category.tracks_batch
--   SQL 82 — product_kind enum + product.kind + store.settlement_days_*,
--            order_payment.card_fee_snapshot_in_cents + settlement_date,
--            order_item.commission_snapshot_in_cents,
--            receivable_payment.late_fee_applied + interest_applied
--
-- NÃO COBERTOS (intencional):
--   SQL 80/81 — parked_sale criação + drop (feature morta antes de uso).
--   SQL 83 — product_cost_component (já em drizzle/0035).
--   Demais supabase/sql/* abaixo de 70 são RLS/triggers/CHECKs que precisam
--   rodar via apply-sql separado (vivem fora do drizzle por escolha de
--   design — DDL idiomático Postgres puro). Sentinela check-sql-applied.mjs
--   valida prod.
--
-- COMENTÁRIOS DE COLUNA / RLS POLICIES preservados nos arquivos originais
-- (supabase/sql/*) — esta migration foca em schema mínimo pra TS bater.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SQL 70 — order_payment.installments (cartão de crédito BR)
-- ---------------------------------------------------------------------
ALTER TABLE "order_payment"
  ADD COLUMN IF NOT EXISTS "installments" smallint NOT NULL DEFAULT 1;

ALTER TABLE "order_payment" DROP CONSTRAINT IF EXISTS "order_payment_installments_range";
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_installments_range"
  CHECK (installments >= 1 AND installments <= 24);

ALTER TABLE "order_payment" DROP CONSTRAINT IF EXISTS "order_payment_installments_credit_only";
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_installments_credit_only"
  CHECK (installments = 1 OR method = 'credit');


-- ---------------------------------------------------------------------
-- SQL 71 — storefront_collection.kicker + bg_color (PP5 handoff)
-- ---------------------------------------------------------------------
ALTER TABLE "storefront_collection"
  ADD COLUMN IF NOT EXISTS "kicker" text,
  ADD COLUMN IF NOT EXISTS "bg_color" text;

ALTER TABLE "storefront_collection" DROP CONSTRAINT IF EXISTS "storefront_collection_bg_color_format";
ALTER TABLE "storefront_collection" ADD CONSTRAINT "storefront_collection_bg_color_format"
  CHECK (bg_color IS NULL OR bg_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');

ALTER TABLE "storefront_collection" DROP CONSTRAINT IF EXISTS "storefront_collection_kicker_length";
ALTER TABLE "storefront_collection" ADD CONSTRAINT "storefront_collection_kicker_length"
  CHECK (kicker IS NULL OR char_length(kicker) <= 30);


-- ---------------------------------------------------------------------
-- SQL 72 — store.card_interest_free_up_to (juros PRICE no PDV)
-- ---------------------------------------------------------------------
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "card_interest_free_up_to" integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_card_interest_free_up_to_range') THEN
    ALTER TABLE "store" ADD CONSTRAINT "store_card_interest_free_up_to_range"
      CHECK (card_interest_free_up_to >= 1 AND card_interest_free_up_to <= 24);
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- SQL 73 — store quotas (max_products_count + max_image_mb)
-- ---------------------------------------------------------------------
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "max_products_count" integer NOT NULL DEFAULT 1000;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "max_image_mb" integer NOT NULL DEFAULT 2;

ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_max_products_count_range";
ALTER TABLE "store" ADD CONSTRAINT "store_max_products_count_range"
  CHECK (max_products_count >= 1 AND max_products_count <= 100000);

ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_max_image_mb_range";
ALTER TABLE "store" ADD CONSTRAINT "store_max_image_mb_range"
  CHECK (max_image_mb >= 1 AND max_image_mb <= 50);


-- ---------------------------------------------------------------------
-- SQL 74 — product.weight_grams (joalheria por grama)
-- ---------------------------------------------------------------------
ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "weight_grams" numeric(10,3);

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_weight_grams_range";
ALTER TABLE "product" ADD CONSTRAINT "product_weight_grams_range"
  CHECK (weight_grams IS NULL OR (weight_grams >= 0 AND weight_grams <= 100000));


-- ---------------------------------------------------------------------
-- SQL 75 — expense table + expense_category enum (DRE honesto S2.1)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE "expense_category" AS ENUM (
      'rent',
      'payroll',
      'utilities',
      'supplies',
      'marketing',
      'tax',
      'card_fees',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "expense" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "store"(id) ON DELETE CASCADE,
  "created_by" text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  "category" "expense_category" NOT NULL DEFAULT 'other',
  "amount_in_cents" integer NOT NULL,
  "paid_at" date,
  "due_date" date,
  "supplier_id" uuid REFERENCES "supplier"(id) ON DELETE SET NULL,
  "recurring" boolean NOT NULL DEFAULT false,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "expense_amount_positive" CHECK (amount_in_cents > 0),
  CONSTRAINT "expense_notes_length" CHECK (notes IS NULL OR length(notes) <= 500),
  CONSTRAINT "expense_has_date" CHECK (paid_at IS NOT NULL OR due_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS "expense_store_paid_at_idx" ON "expense" ("store_id", "paid_at" DESC);
CREATE INDEX IF NOT EXISTS "expense_store_category_idx" ON "expense" ("store_id", "category");
CREATE INDEX IF NOT EXISTS "expense_store_supplier_idx"
  ON "expense" ("store_id", "supplier_id") WHERE "supplier_id" IS NOT NULL;

ALTER TABLE "expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_tenant_isolation" ON "expense";
CREATE POLICY "expense_tenant_isolation" ON "expense"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- GRANT pra vitre_app só roda se o role existir (CI/local podem usar
-- superuser sem vitre_app — pular silenciosamente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vitre_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "expense" TO vitre_app;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- SQL 76 — store.card_real_fee_bps_* (taxa real maquininha S2.4)
-- ---------------------------------------------------------------------
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "card_real_fee_bps_debit" integer NOT NULL DEFAULT 199;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "card_real_fee_bps_credit_1x" integer NOT NULL DEFAULT 350;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "card_real_fee_bps_credit_2x_to_6x" integer NOT NULL DEFAULT 599;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "card_real_fee_bps_credit_7x_to_12x" integer NOT NULL DEFAULT 899;

ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_card_real_fee_ranges";
ALTER TABLE "store" ADD CONSTRAINT "store_card_real_fee_ranges"
  CHECK (
    card_real_fee_bps_debit BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_1x BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_2x_to_6x BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_7x_to_12x BETWEEN 0 AND 9999
  );


-- ---------------------------------------------------------------------
-- SQL 77 — product_variant.cost_price_in_cents (WAC variante-aware)
-- ---------------------------------------------------------------------
ALTER TABLE "product_variant"
  ADD COLUMN IF NOT EXISTS "cost_price_in_cents" integer;

ALTER TABLE "product_variant" DROP CONSTRAINT IF EXISTS "product_variant_cost_price_nonneg";
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_cost_price_nonneg"
  CHECK (cost_price_in_cents IS NULL OR cost_price_in_cents >= 0);


-- ---------------------------------------------------------------------
-- SQL 78 — multa + juros em fiado (S3.2)
-- ---------------------------------------------------------------------
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "receivable_default_late_fee_bps" integer NOT NULL DEFAULT 200;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "receivable_default_interest_bps" integer NOT NULL DEFAULT 100;

ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_receivable_fees_range";
ALTER TABLE "store" ADD CONSTRAINT "store_receivable_fees_range"
  CHECK (
    receivable_default_late_fee_bps BETWEEN 0 AND 9999
    AND receivable_default_interest_bps BETWEEN 0 AND 9999
  );

ALTER TABLE "receivable"
  ADD COLUMN IF NOT EXISTS "late_fee_bps" integer;
ALTER TABLE "receivable"
  ADD COLUMN IF NOT EXISTS "interest_per_month_bps" integer;

ALTER TABLE "receivable" DROP CONSTRAINT IF EXISTS "receivable_fees_range";
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_fees_range"
  CHECK (
    (late_fee_bps IS NULL OR (late_fee_bps BETWEEN 0 AND 9999))
    AND (interest_per_month_bps IS NULL OR (interest_per_month_bps BETWEEN 0 AND 9999))
  );


-- ---------------------------------------------------------------------
-- SQL 79 — lote + validade em compra (S3.4 perfumaria/cosmético)
-- ---------------------------------------------------------------------
ALTER TABLE "purchase_item"
  ADD COLUMN IF NOT EXISTS "batch_number" text;
ALTER TABLE "purchase_item"
  ADD COLUMN IF NOT EXISTS "expires_at" date;

ALTER TABLE "purchase_item" DROP CONSTRAINT IF EXISTS "purchase_item_batch_length";
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_batch_length"
  CHECK (batch_number IS NULL OR length(batch_number) <= 60);

CREATE INDEX IF NOT EXISTS "purchase_item_expires_at_idx"
  ON "purchase_item" ("expires_at") WHERE "expires_at" IS NOT NULL;

ALTER TABLE "category"
  ADD COLUMN IF NOT EXISTS "tracks_batch" boolean NOT NULL DEFAULT false;


-- ---------------------------------------------------------------------
-- SQL 82 — Bloco B ressignificação (kind + snapshots + settlement)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_kind') THEN
    CREATE TYPE "product_kind" AS ENUM ('raw_material', 'finished_good', 'service');
  END IF;
END $$;

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "kind" "product_kind" NOT NULL DEFAULT 'finished_good';

CREATE INDEX IF NOT EXISTS "product_store_kind_idx" ON "product" ("store_id", "kind");

ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "settlement_days_pix" integer NOT NULL DEFAULT 0;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "settlement_days_debit" integer NOT NULL DEFAULT 1;
ALTER TABLE "store"
  ADD COLUMN IF NOT EXISTS "settlement_days_credit" integer NOT NULL DEFAULT 30;

ALTER TABLE "store" DROP CONSTRAINT IF EXISTS "store_settlement_days_range";
ALTER TABLE "store" ADD CONSTRAINT "store_settlement_days_range"
  CHECK (
    settlement_days_pix BETWEEN 0 AND 90
    AND settlement_days_debit BETWEEN 0 AND 90
    AND settlement_days_credit BETWEEN 0 AND 90
  );

ALTER TABLE "order_payment"
  ADD COLUMN IF NOT EXISTS "card_fee_snapshot_in_cents" integer;
ALTER TABLE "order_payment"
  ADD COLUMN IF NOT EXISTS "settlement_date" date;

ALTER TABLE "order_payment" DROP CONSTRAINT IF EXISTS "order_payment_card_fee_nonneg";
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_card_fee_nonneg"
  CHECK (card_fee_snapshot_in_cents IS NULL OR card_fee_snapshot_in_cents >= 0);

ALTER TABLE "order_item"
  ADD COLUMN IF NOT EXISTS "commission_snapshot_in_cents" integer;

ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "order_item_commission_nonneg";
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_commission_nonneg"
  CHECK (commission_snapshot_in_cents IS NULL OR commission_snapshot_in_cents >= 0);

ALTER TABLE "receivable_payment"
  ADD COLUMN IF NOT EXISTS "late_fee_applied_in_cents" integer;
ALTER TABLE "receivable_payment"
  ADD COLUMN IF NOT EXISTS "interest_applied_in_cents" integer;

ALTER TABLE "receivable_payment" DROP CONSTRAINT IF EXISTS "receivable_payment_fees_nonneg";
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_fees_nonneg"
  CHECK (
    (late_fee_applied_in_cents IS NULL OR late_fee_applied_in_cents >= 0)
    AND (interest_applied_in_cents IS NULL OR interest_applied_in_cents >= 0)
  );
