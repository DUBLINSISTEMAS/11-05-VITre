-- =====================================================================
-- Mangos Pay — cost_price_in_cents na variante (S2.6 do Plano)
-- =====================================================================
-- CONTEXTO
-- Joalheria cadastra MESMA SKU em 2 variantes: ouro 18k (R$ 600) e
-- banhado (R$ 30). Hoje as duas compartilham o MESMO custo no nível
-- de produto (WAC do `product`). Quando lojista compra:
--   - 5 ouro 18k a R$ 600/un (R$ 3.000 total)
--   - 10 banhado a R$ 30/un  (R$    300 total)
--
-- WAC do produto = (5 × 600 + 10 × 30) / 15 = R$ 220/un.
--
-- Resultado: relatório de margem mostra
--   ouro vendido a R$ 980: margem (980 - 220) / 980 = 77%  (otimista)
--   banhado a R$ 80:        margem (80 - 220) / 80 = -175% (mente)
--
-- Joalheria de ouro do ICP é INUTILIZÁVEL com esse comportamento.
--
-- DESIGN
-- - Coluna `cost_price_in_cents integer` nullable na variante.
-- - NULL = herda de product.cost_price_in_cents (comportamento atual,
--   compatível com produtos sem variante OU loja simples).
-- - CHECK >= 0.
--
-- BACKFILL
-- Nada copiado — todas as variantes existentes ficam NULL = herdam.
-- Lojista preenche valores corretos ao usar `purchase` (WAC variante-aware
-- atualiza só a variante comprada) OU manualmente no form.
--
-- WAC variante-aware
-- src/actions/purchase/index.ts já passa por refator:
--   - Se purchase_item.variant_id IS NOT NULL: lock + WAC em variant
--   - Else: lock + WAC em product (comportamento atual)
--
-- load-margin.ts usa coalesce(variant.cost, product.cost) no JOIN.
-- KPI stock honra variant.cost quando disponível.
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS.
-- =====================================================================

ALTER TABLE product_variant
  ADD COLUMN IF NOT EXISTS cost_price_in_cents integer;

ALTER TABLE product_variant
  DROP CONSTRAINT IF EXISTS product_variant_cost_price_nonneg;
ALTER TABLE product_variant
  ADD CONSTRAINT product_variant_cost_price_nonneg
  CHECK (cost_price_in_cents IS NULL OR cost_price_in_cents >= 0);

COMMENT ON COLUMN product_variant.cost_price_in_cents IS
  'Custo médio ponderado da variante (centavos). NULL = herda de product.cost_price_in_cents. Atualizado pelo WAC variante-aware em src/actions/purchase quando purchase_item.variant_id é informado.';
