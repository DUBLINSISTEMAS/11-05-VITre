-- ADR-0034 Camada 2 — preço de atacado em product.
-- CHECK: wholesale_price_in_cents >= 0 (NULL aceito) e wholesale <= base
-- (atacado nunca pode ser maior que varejo — seria erro de cadastro).
-- Idempotente.

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_wholesale_price_nonneg;
ALTER TABLE "product" ADD CONSTRAINT product_wholesale_price_nonneg
  CHECK (wholesale_price_in_cents IS NULL OR wholesale_price_in_cents >= 0);

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS product_wholesale_lte_base;
ALTER TABLE "product" ADD CONSTRAINT product_wholesale_lte_base
  CHECK (
    wholesale_price_in_cents IS NULL
    OR wholesale_price_in_cents <= base_price_in_cents
  );
