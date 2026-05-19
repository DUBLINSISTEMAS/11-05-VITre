-- ADR-0034 Camada 1 — Dado-fonte da Camada Comercial Vitrê.
-- CHECK constraints + UNIQUE parciais que Drizzle não captura.
-- Idempotente (DROP IF EXISTS antes de criar). Aplicar em prod após
-- a migration drizzle/0031_*.sql.

-- =====================================================================
-- product — novos campos da Camada 1
-- =====================================================================

-- Custo unitário >= 0 quando preenchido (NULL aceito = lojista ainda não cadastrou).
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_cost_price_nonneg;
ALTER TABLE "product" ADD CONSTRAINT product_cost_price_nonneg
  CHECK (cost_price_in_cents IS NULL OR cost_price_in_cents >= 0);

-- Estoque mínimo/máximo >= 0 quando preenchidos.
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_min_stock_nonneg;
ALTER TABLE "product" ADD CONSTRAINT product_min_stock_nonneg
  CHECK (min_stock_quantity IS NULL OR min_stock_quantity >= 0);

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_max_stock_nonneg;
ALTER TABLE "product" ADD CONSTRAINT product_max_stock_nonneg
  CHECK (max_stock_quantity IS NULL OR max_stock_quantity >= 0);

-- max >= min quando ambos preenchidos.
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_max_gte_min;
ALTER TABLE "product" ADD CONSTRAINT product_max_gte_min
  CHECK (
    max_stock_quantity IS NULL
    OR min_stock_quantity IS NULL
    OR max_stock_quantity >= min_stock_quantity
  );

-- GTIN: 8/12/13/14 dígitos só. NULL aceito.
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_gtin_format;
ALTER TABLE "product" ADD CONSTRAINT product_gtin_format
  CHECK (
    gtin IS NULL
    OR (gtin ~ '^[0-9]+$' AND length(gtin) IN (8, 12, 13, 14))
  );

-- NCM: 8 dígitos exatos (formato BR). NULL aceito. Vitrê não valida
-- tabela TIPI nem dígito verificador — só formato (ADR-0033).
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_ncm_format;
ALTER TABLE "product" ADD CONSTRAINT product_ncm_format
  CHECK (
    ncm IS NULL
    OR (ncm ~ '^[0-9]+$' AND length(ncm) = 8)
  );

-- Comissão default em basis points (0..10000 = 0..100%).
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_commission_bps_range;
ALTER TABLE "product" ADD CONSTRAINT product_commission_bps_range
  CHECK (
    default_commission_bps IS NULL
    OR (default_commission_bps >= 0 AND default_commission_bps <= 10000)
  );

-- UNIQUE parcial: (store, gtin) WHERE gtin IS NOT NULL.
-- Múltiplos produtos sem GTIN são OK no mesmo tenant; com GTIN, único.
DROP INDEX IF EXISTS product_store_gtin_unique;
CREATE UNIQUE INDEX product_store_gtin_unique
  ON "product" (store_id, gtin)
  WHERE gtin IS NOT NULL;

-- UNIQUE parcial: (store, internal_code) WHERE internal_code IS NOT NULL.
DROP INDEX IF EXISTS product_store_internal_code_unique;
CREATE UNIQUE INDEX product_store_internal_code_unique
  ON "product" (store_id, internal_code)
  WHERE internal_code IS NOT NULL;

-- =====================================================================
-- order_item — snapshot de custo da Camada 1
-- =====================================================================
ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS order_item_unit_cost_snapshot_nonneg;
ALTER TABLE "order_item" ADD CONSTRAINT order_item_unit_cost_snapshot_nonneg
  CHECK (unit_cost_snapshot_in_cents IS NULL OR unit_cost_snapshot_in_cents >= 0);

-- =====================================================================
-- order_payment — pagamento dividido
-- =====================================================================
-- Valor > 0 (linha de pagamento R$ 0 não faz sentido).
ALTER TABLE "order_payment" DROP CONSTRAINT IF EXISTS order_payment_amount_positive;
ALTER TABLE "order_payment" ADD CONSTRAINT order_payment_amount_positive
  CHECK (amount_in_cents > 0);

-- cash_received_in_cents: relevante só pra method='cash', e >= amount
-- (cliente entrega o valor da venda + extra pra troco).
ALTER TABLE "order_payment" DROP CONSTRAINT IF EXISTS order_payment_cash_received_consistent;
ALTER TABLE "order_payment" ADD CONSTRAINT order_payment_cash_received_consistent
  CHECK (
    (method = 'cash' AND (cash_received_in_cents IS NULL OR cash_received_in_cents >= amount_in_cents))
    OR (method <> 'cash' AND cash_received_in_cents IS NULL)
  );

-- =====================================================================
-- supplier — fornecedor
-- =====================================================================
-- Document (CPF 11 ou CNPJ 14 dígitos sem máscara). NULL aceito.
ALTER TABLE "supplier" DROP CONSTRAINT IF EXISTS supplier_document_format;
ALTER TABLE "supplier" ADD CONSTRAINT supplier_document_format
  CHECK (
    document IS NULL
    OR (document ~ '^[0-9]+$' AND length(document) IN (11, 14))
  );

-- UF 2 letras maiúsculas (igual customer).
ALTER TABLE "supplier" DROP CONSTRAINT IF EXISTS supplier_state_format;
ALTER TABLE "supplier" ADD CONSTRAINT supplier_state_format
  CHECK (
    address_state IS NULL
    OR (address_state ~ '^[A-Z]{2}$')
  );

-- CEP 8 dígitos sem máscara (igual customer).
ALTER TABLE "supplier" DROP CONSTRAINT IF EXISTS supplier_zip_format;
ALTER TABLE "supplier" ADD CONSTRAINT supplier_zip_format
  CHECK (
    address_zip IS NULL
    OR (address_zip ~ '^[0-9]{8}$')
  );

-- =====================================================================
-- purchase — compra/entrada de fornecedor
-- =====================================================================
ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS purchase_total_nonneg;
ALTER TABLE "purchase" ADD CONSTRAINT purchase_total_nonneg
  CHECK (total_in_cents >= 0);

-- payment_method só faz sentido se paid_at NOT NULL.
ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS purchase_payment_method_when_paid;
ALTER TABLE "purchase" ADD CONSTRAINT purchase_payment_method_when_paid
  CHECK (
    (paid_at IS NOT NULL AND payment_method IS NOT NULL)
    OR (paid_at IS NULL AND payment_method IS NULL)
  );

-- =====================================================================
-- purchase_item — itens da compra
-- =====================================================================
ALTER TABLE "purchase_item" DROP CONSTRAINT IF EXISTS purchase_item_quantity_positive;
ALTER TABLE "purchase_item" ADD CONSTRAINT purchase_item_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE "purchase_item" DROP CONSTRAINT IF EXISTS purchase_item_unit_cost_nonneg;
ALTER TABLE "purchase_item" ADD CONSTRAINT purchase_item_unit_cost_nonneg
  CHECK (unit_cost_in_cents >= 0);

-- =====================================================================
-- receivable — fiado/crediário
-- =====================================================================
ALTER TABLE "receivable" DROP CONSTRAINT IF EXISTS receivable_amount_positive;
ALTER TABLE "receivable" ADD CONSTRAINT receivable_amount_positive
  CHECK (amount_in_cents > 0);

-- paid_method só faz sentido quando paid_at NOT NULL.
ALTER TABLE "receivable" DROP CONSTRAINT IF EXISTS receivable_paid_method_when_paid;
ALTER TABLE "receivable" ADD CONSTRAINT receivable_paid_method_when_paid
  CHECK (
    (paid_at IS NOT NULL AND paid_method IS NOT NULL)
    OR (paid_at IS NULL AND paid_method IS NULL)
  );
