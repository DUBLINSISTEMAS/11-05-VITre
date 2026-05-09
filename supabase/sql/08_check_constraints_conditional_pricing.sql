-- =====================================================================
-- Vitrê — CHECK condicional de preço alinhado ao lifecycle do produto
-- =====================================================================
-- Refina os 3 CHECKs de preço do supabase/sql/07 (`>= 0`) pra invariantes
-- semanticamente alinhadas com o domínio:
--
--   product.base_price_in_cents:
--     Antes: `>= 0`         (permitia produto publicado com preço zero)
--     Agora: `is_active = false OR base_price_in_cents > 0`
--     Justificativa: rascunho/oculto pode ter preço 0 (default do
--     createDraftProduct); produto VISÍVEL ao cliente final exige preço.
--
--   product.promo_price_in_cents:
--     Antes: `IS NULL OR >= 0`
--     Agora: `IS NULL OR > 0`
--     Justificativa: NULL = "sem promoção"; quando há promo, deve ser positivo.
--
--   product_variant.price_in_cents:
--     Antes: `IS NULL OR >= 0`
--     Agora: `IS NULL OR > 0`
--     Justificativa: NULL = "herda basePrice do produto"; quando override,
--     deve ser positivo (variante grátis não faz sentido no domínio).
--
-- Execução:
--   `npm run db:apply -- supabase/sql/08_check_constraints_conditional_pricing.sql`
--
-- Idempotente: DROP CONSTRAINT IF EXISTS + CREATE guardado por NOT EXISTS.
-- Se o DB nunca passou pelo SQL 07, os DROPs são no-op e os CREATEs aplicam direto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- product.base_price_in_cents — condicional ao is_active
-- ---------------------------------------------------------------------
ALTER TABLE "product"
  DROP CONSTRAINT IF EXISTS "product_base_price_in_cents_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_base_price_in_cents_check'
       AND conrelid = '"product"'::regclass
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_base_price_in_cents_check"
      CHECK ("is_active" = false OR "base_price_in_cents" > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product.promo_price_in_cents — quando NÃO NULL, deve ser > 0
-- ---------------------------------------------------------------------
ALTER TABLE "product"
  DROP CONSTRAINT IF EXISTS "product_promo_price_in_cents_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_promo_price_in_cents_check'
       AND conrelid = '"product"'::regclass
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_promo_price_in_cents_check"
      CHECK ("promo_price_in_cents" IS NULL OR "promo_price_in_cents" > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product_variant.price_in_cents — quando NÃO NULL, deve ser > 0
-- ---------------------------------------------------------------------
ALTER TABLE "product_variant"
  DROP CONSTRAINT IF EXISTS "product_variant_price_in_cents_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_variant_price_in_cents_check'
       AND conrelid = '"product_variant"'::regclass
  ) THEN
    ALTER TABLE "product_variant"
      ADD CONSTRAINT "product_variant_price_in_cents_check"
      CHECK ("price_in_cents" IS NULL OR "price_in_cents" > 0);
  END IF;
END $$;
