-- =====================================================================
-- Mangos Pay — Peso em gramas no produto (S2.7 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- Joalheria de ouro 18k vende por GRAMA. Anel solitário 4mm = ~4g a
-- R$ 320/g = R$ 1.280. Quando ouro sobe pra R$ 340/g, lojista TEM que
-- reprecificar todos os SKUs. Hoje faz manual produto-a-produto.
-- Em loja média do ICP (200 SKUs ouro) = 1 dia inteiro de trabalho.
--
-- DESIGN
-- - Coluna `weight_grams numeric(10,3)` nullable. Não-obrigatório porque
--   loja de roupa/perfumaria não precisa. Joalheria preenche.
-- - Precisão 3 casas (mg) porque ouro 18k de pingente pode ter 0.450g.
-- - CHECK >= 0 (nunca negativo).
-- - Range superior: 100kg (= 100000g) — sanidade pra evitar typo "4000g"
--   quando era "4g" sem warning.
--
-- ENFORCEMENT
-- - Form de produto (aba "Identidade") expõe campo.
-- - Filtro condicional na UI: aparece quando `niche=joia|semijoia` OU
--   quando produto está em categoria marcada (decisão UX — pode mostrar
--   sempre nullable, ou esconder fora do ICP de ouro).
--
-- FUTURO (Fase 3): relatório "Reprecificar por grama" — input R$/g novo,
-- output preview de novos preços. Vai usar este campo.
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS (Postgres 9.6+).
-- =====================================================================

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS weight_grams numeric(10,3);

-- CHECK: range válido (0..100000g = 100kg). NULL permitido.
ALTER TABLE product
  DROP CONSTRAINT IF EXISTS product_weight_grams_range;
ALTER TABLE product
  ADD CONSTRAINT product_weight_grams_range
  CHECK (weight_grams IS NULL OR (weight_grams >= 0 AND weight_grams <= 100000));

COMMENT ON COLUMN product.weight_grams IS
  'Peso em gramas (precisão 3 casas). Usado por joalheria pra reprecificação por grama de ouro. Nullable.';
