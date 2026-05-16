-- =====================================================================
-- SQL 19 — CHECK constraint para `product.cash_discount_override_bps`.
-- Fase 2 / ADR-0013 (refactor 2026-05-16).
--
-- Range válido: 0..9999 basis points (= 0% a 99.99%), ou NULL (= usa
-- default da loja). 0 também é override válido — significa "este produto
-- NÃO tem desconto à vista mesmo que a loja ofereça".
--
-- Out-of-band porque drizzle-kit não captura CHECK constraints em
-- ADD COLUMN de forma estável (mesma razão dos SQLs 07, 14, 17).
-- Aplicar manualmente no Editor do Supabase APÓS rodar
-- `pnpm db:migrate` que aplica `0015_nebulous_skaar.sql`.
--
-- Idempotente? Não — se rodar 2x dá "constraint already exists". Ignore.
-- =====================================================================

ALTER TABLE "product"
  ADD CONSTRAINT "product_cash_discount_override_bps_range"
    CHECK (
      "cash_discount_override_bps" IS NULL
      OR "cash_discount_override_bps" BETWEEN 0 AND 9999
    );
