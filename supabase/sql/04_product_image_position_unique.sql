-- =====================================================================
-- Vitrê — UNIQUE(product_id, position) em product_image
-- =====================================================================
-- ⚠️ CONSOLIDADO em drizzle/0004_public_order_token_stock_hardening.sql
-- (constraint declarada também em src/db/schema/catalog.ts).
--
-- Este arquivo é mantido apenas como REGISTRO HISTÓRICO da aplicação
-- manual feita em produção antes da regularização do journal Drizzle.
-- NÃO precisa ser executado em ambientes novos — drizzle-kit migrate
-- aplica via 0004 (idempotente).
--
-- Idempotente: bloco DO + check em pg_constraint.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_image_product_position_unique'
      AND conrelid = '"product_image"'::regclass
  ) THEN
    ALTER TABLE "product_image"
      ADD CONSTRAINT "product_image_product_position_unique"
      UNIQUE ("product_id", "position");
  END IF;
END $$;
