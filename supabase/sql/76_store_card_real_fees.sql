-- =====================================================================
-- Mangos Pay — Taxa real da maquininha (S2.4 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- Hoje order_payment tem `surcharge_in_cents` que é o que o lojista COBRA
-- do cliente pra "absorver" a taxa. Mas a TAXA REAL que Stone/Cielo cobra
-- DO LOJISTA não está em lugar nenhum.
--
-- Lojista vende R$ 1.000 no cartão crédito 12x. Stone fica com ~12% =
-- R$ 120. Recebe R$ 880 na conta. Mas o DRE mostra R$ 1.000 de receita.
-- Em loja com >50% de venda cartão, o DRE mente em ~10% pra cima.
--
-- DESIGN
-- 4 buckets de taxa (em bps = 0.01%, padrão Mangos Pay):
--   debit            (default 199 = 1.99%)
--   credit_1x        (default 350 = 3.50%)
--   credit_2x_to_6x  (default 599 = 5.99%)
--   credit_7x_to_12x (default 1199 = 11.99%)
--
-- Defaults baseados em média Stone/Cielo/Rede 2025. Lojista ajusta no
-- /admin/pagamento conforme contrato real da maquininha dele.
--
-- DRE deduz: SUM(order_payment.amount_in_cents × fee_bps / 10000)
-- agrupado por method+installments, lança como "Taxas de maquininha"
-- no operatingExpensesByCategory (categoria 'card_fees').
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS.
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_debit integer NOT NULL DEFAULT 199;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_1x integer NOT NULL DEFAULT 350;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_2x_to_6x integer NOT NULL DEFAULT 599;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_real_fee_bps_credit_7x_to_12x integer NOT NULL DEFAULT 1199;

-- CHECK: range 0..9999 (0%..99.99%). Acima de 99.99% não faz sentido
-- comercial — provável typo. Setor 1 (vista) seria 0 = sem taxa.
ALTER TABLE store
  DROP CONSTRAINT IF EXISTS store_card_real_fee_ranges;
ALTER TABLE store
  ADD CONSTRAINT store_card_real_fee_ranges
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
