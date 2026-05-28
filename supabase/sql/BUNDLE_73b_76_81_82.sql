-- =====================================================================
-- Mangos Pay — BUNDLE de 4 migrations pendentes em prod (2026-05-28)
-- =====================================================================
-- Disparado por erro `column "settlement_days_pix" does not exist` no
-- dev local apontando pra Supabase prod. Schema TS (`src/db/schema/store.ts`,
-- `product.ts`, `order_payment.ts`, etc) já referencia colunas que NÃO
-- foram aplicadas em prod.
--
-- Bundle contém os 4 SQLs pendentes na ordem cronológica:
--   1. SQL 73 — store quotas (max_products_count, max_image_mb) — 73b CHECKs
--   2. SQL 76 — store card fees REAIS (debit/credit_1x/2_6x/7_12x)
--   3. SQL 81 — drop parked_sale (cleanup, feature nunca foi ativada)
--   4. SQL 82 — product.kind enum + settlement_days + snapshots
--
-- Todos idempotentes (ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS).
-- Pode rodar 1 vez ou 5, mesmo resultado.
--
-- COMO RODAR
-- 1. Abra Supabase SQL Editor (projeto vitre / zwbkzkyunbmoihcbeztm)
-- 2. New query → cole TUDO abaixo desta linha de "=" até o fim
-- 3. RUN
-- 4. Espera: "Success. No rows returned"
-- 5. Local: `node scripts/check-sql-applied.mjs` deve mostrar 96/96 ✅
-- =====================================================================


-- =====================================================================
-- SQL 73 — Quota por loja (max_products_count + max_image_mb + CHECKs)
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS max_products_count integer NOT NULL DEFAULT 1000;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS max_image_mb integer NOT NULL DEFAULT 2;

ALTER TABLE store DROP CONSTRAINT IF EXISTS store_max_products_count_range;
ALTER TABLE store ADD CONSTRAINT store_max_products_count_range
  CHECK (max_products_count >= 1 AND max_products_count <= 100000);

ALTER TABLE store DROP CONSTRAINT IF EXISTS store_max_image_mb_range;
ALTER TABLE store ADD CONSTRAINT store_max_image_mb_range
  CHECK (max_image_mb >= 1 AND max_image_mb <= 50);

COMMENT ON COLUMN store.max_products_count IS
  'Limite máximo de produtos da loja. Default 1000 (Free). Plano pago sobe via UPDATE.';
COMMENT ON COLUMN store.max_image_mb IS
  'Tamanho máximo de imagem em MB. Default 2 (sharp comprime pra ~150KB, 2MB é safety net).';


-- =====================================================================
-- SQL 76 — Taxa real da maquininha (4 buckets bps)
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_debit integer NOT NULL DEFAULT 199;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_1x integer NOT NULL DEFAULT 350;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_2x_to_6x integer NOT NULL DEFAULT 599;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_7x_to_12x integer NOT NULL DEFAULT 1199;

ALTER TABLE store DROP CONSTRAINT IF EXISTS store_card_real_fee_ranges;
ALTER TABLE store ADD CONSTRAINT store_card_real_fee_ranges
  CHECK (
    card_real_fee_bps_debit BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_1x BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_2x_to_6x BETWEEN 0 AND 9999
    AND card_real_fee_bps_credit_7x_to_12x BETWEEN 0 AND 9999
  );

COMMENT ON COLUMN store.card_real_fee_bps_debit IS
  'Taxa real cobrada pelo adquirente em vendas débito (bps). Default 199 = 1.99%. Ajustar conforme contrato Stone/Cielo/Rede.';
COMMENT ON COLUMN store.card_real_fee_bps_credit_1x IS
  'Taxa real crédito à vista (bps). Default 350 = 3.50%.';
COMMENT ON COLUMN store.card_real_fee_bps_credit_2x_to_6x IS
  'Taxa real crédito parcelado 2-6x (bps). Default 599 = 5.99%.';
COMMENT ON COLUMN store.card_real_fee_bps_credit_7x_to_12x IS
  'Taxa real crédito parcelado 7-12x (bps). Default 1199 = 11.99%.';


-- =====================================================================
-- SQL 81 — Drop parked_sale (cleanup pós dead code sweep)
-- =====================================================================

DROP TABLE IF EXISTS parked_sale CASCADE;


-- =====================================================================
-- SQL 82 — Bloco B da ressignificação:
--   product.kind enum + store.settlement_days + snapshots fee/commission/late
-- =====================================================================

-- 1. ENUM product_kind ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_kind') THEN
    CREATE TYPE product_kind AS ENUM ('raw_material', 'finished_good', 'service');
  END IF;
END $$;

-- 2. product.kind ----------------------------------------------------
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS kind product_kind NOT NULL DEFAULT 'finished_good';

CREATE INDEX IF NOT EXISTS product_store_kind_idx ON product (store_id, kind);

COMMENT ON COLUMN product.kind IS
  'Universo do produto: raw_material (matéria-prima/ativo, NÃO vende em canal), finished_good (comercializável — default), service. Default preserva compat com produtos existentes.';

-- 3. store.settlement_days_{pix,debit,credit} ----------------------------
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_pix integer NOT NULL DEFAULT 0;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_debit integer NOT NULL DEFAULT 1;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_credit integer NOT NULL DEFAULT 30;

ALTER TABLE store DROP CONSTRAINT IF EXISTS store_settlement_days_range;
ALTER TABLE store ADD CONSTRAINT store_settlement_days_range
  CHECK (
    settlement_days_pix BETWEEN 0 AND 90
    AND settlement_days_debit BETWEEN 0 AND 90
    AND settlement_days_credit BETWEEN 0 AND 90
  );

COMMENT ON COLUMN store.settlement_days_pix IS
  'Dias até PIX cair na conta. Default 0 (D+0). Range 0..90.';
COMMENT ON COLUMN store.settlement_days_debit IS
  'Dias até débito cair na conta. Default 1 (D+1 padrão maquininha). Range 0..90.';
COMMENT ON COLUMN store.settlement_days_credit IS
  'Dias até crédito cair na conta. Default 30 (D+30 padrão maquininha sem antecipação). Range 0..90.';

-- 4. order_payment.card_fee_snapshot_in_cents + settlement_date ----------
ALTER TABLE order_payment
  ADD COLUMN IF NOT EXISTS card_fee_snapshot_in_cents integer;
ALTER TABLE order_payment
  ADD COLUMN IF NOT EXISTS settlement_date date;

ALTER TABLE order_payment DROP CONSTRAINT IF EXISTS order_payment_card_fee_nonneg;
ALTER TABLE order_payment ADD CONSTRAINT order_payment_card_fee_nonneg
  CHECK (card_fee_snapshot_in_cents IS NULL OR card_fee_snapshot_in_cents >= 0);

COMMENT ON COLUMN order_payment.card_fee_snapshot_in_cents IS
  'Taxa real cobrada pela maquininha NESTA linha de pagamento em centavos. Snapshot — fica fixo mesmo se lojista mudar store.card_real_fee_bps_* depois. NULL pra cash/pix/other.';
COMMENT ON COLUMN order_payment.settlement_date IS
  'Data calculada de quando o valor cai na conta (createdAt + store.settlement_days do método). NULL pra cash.';

-- 5. order_item.commission_snapshot_in_cents ----------------------------
ALTER TABLE order_item
  ADD COLUMN IF NOT EXISTS commission_snapshot_in_cents integer;

ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_commission_nonneg;
ALTER TABLE order_item ADD CONSTRAINT order_item_commission_nonneg
  CHECK (commission_snapshot_in_cents IS NULL OR commission_snapshot_in_cents >= 0);

COMMENT ON COLUMN order_item.commission_snapshot_in_cents IS
  'Comissão da vendedora calculada nesta linha em centavos. NULL pra orders sem seller_id ou produtos sem default_commission_bps. Snapshot.';

-- 6. receivable_payment.late_fee_applied + interest_applied -------------
ALTER TABLE receivable_payment
  ADD COLUMN IF NOT EXISTS late_fee_applied_in_cents integer;
ALTER TABLE receivable_payment
  ADD COLUMN IF NOT EXISTS interest_applied_in_cents integer;

ALTER TABLE receivable_payment DROP CONSTRAINT IF EXISTS receivable_payment_fees_nonneg;
ALTER TABLE receivable_payment ADD CONSTRAINT receivable_payment_fees_nonneg
  CHECK (
    (late_fee_applied_in_cents IS NULL OR late_fee_applied_in_cents >= 0)
    AND (interest_applied_in_cents IS NULL OR interest_applied_in_cents >= 0)
  );

COMMENT ON COLUMN receivable_payment.late_fee_applied_in_cents IS
  'Multa REAL cobrada nesta linha de pagamento em centavos. NULL pra pagamento em dia ou linha pré-SQL 78.';
COMMENT ON COLUMN receivable_payment.interest_applied_in_cents IS
  'Juros REAIS cobrados em centavos. NULL pra pagamento em dia.';


-- =====================================================================
-- FIM — esperado: "Success. No rows returned"
-- Validar local: `node scripts/check-sql-applied.mjs`  → 96/96 ✅
-- =====================================================================
