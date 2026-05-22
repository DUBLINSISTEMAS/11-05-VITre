-- =====================================================================
-- Mangos Pay — Sprint 2.3 (2026-05-22): order.shipping_in_cents
-- =====================================================================
-- CONTEXTO
-- ADR-0020 criou `surcharge_in_cents` como bucket genérico pra "taxa
-- cartão, frete, embalagem, fechar redondo". O DRE classifica tudo
-- isso como Acréscimo, o que infla a receita e atrapalha o contador
-- a entender quanto realmente entrou na loja (vs quanto foi repasse
-- pra correios/transportadora).
--
-- Separação:
--   - surcharge_in_cents continua representando "Acréscimos" reais
--     (taxa cartão, taxa PIX, embalagem cobrada). Esse dinheiro fica
--     com o lojista — entra no resultado.
--   - shipping_in_cents é novo: cobre frete cobrado do cliente que
--     vai pra transportadora/correios. Esse dinheiro PASSA pela loja
--     mas não é receita — é repasse. Aparece como linha separada no
--     DRE.
--
-- DEPLOY
-- ADD COLUMN com DEFAULT 0 + NOT NULL é metadata-only no PostgreSQL
-- 11+ (não scaneia tabela). Seguro mesmo com milhões de linhas.
--
-- CHECK >= 0 simétrico ao surcharge.
--
-- BACKFILL
-- Não migra dados existentes — pedidos antigos têm shipping_in_cents=0
-- (não dá pra inferir retroativamente quanto do surcharge era frete).
-- A partir desta SQL, novos PDV/checkout devem usar shipping pra frete
-- e surcharge só pra taxas. Migração da UI fica pra Sprint posterior.
--
-- INVARIANTE
-- order.total_in_cents = SUM(item.price * qty) - discount + surcharge + shipping
-- Atualmente o cálculo do total no app NÃO inclui shipping (pq sempre 0).
-- Quando UI for migrada, app precisa somar shipping ao total também.
-- =====================================================================

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS shipping_in_cents integer NOT NULL DEFAULT 0;

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS order_shipping_nonneg;
ALTER TABLE "order"
  ADD CONSTRAINT order_shipping_nonneg
  CHECK (shipping_in_cents >= 0);
