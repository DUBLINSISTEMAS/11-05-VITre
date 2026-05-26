-- SQL 72 — Sprint 3 (audit 2026-05-26): cartão de crédito com juros no PDV.
--
-- A coluna `card_interest_rate_bps` JÁ EXISTE no schema (reservada na Fase 2
-- como gate placeholder, default 0). Esta migration apenas ADICIONA a regra
-- complementar `card_interest_free_up_to`: número de parcelas sem juros antes
-- de aplicar a taxa.
--
-- Padrão varejo BR: lojista comunica "3x sem juros, acima cobramos taxa". O
-- PDV calcula via Sistema PRICE para installments > free_up_to:
--
--   i = card_interest_rate_bps / 10000  (decimal mensal; ex 299 bps = 0.0299)
--   parcela = total × (i × (1+i)^n) / ((1+i)^n − 1)
--
-- card_interest_rate_bps: ALREADY EXISTS. Range 0..9999 (já tem CHECK no SQL 17).
-- card_interest_free_up_to: NEW. Range 1..24. Default 1 (só 1x sem juros).

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS card_interest_free_up_to integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_card_interest_free_up_to_range'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_card_interest_free_up_to_range
        CHECK (card_interest_free_up_to >= 1 AND card_interest_free_up_to <= 24);
  END IF;
END $$;

COMMENT ON COLUMN store.card_interest_free_up_to IS
  'Sprint 3 (2026-05-26): número máximo de parcelas SEM juros (1..24). Acima disso, PDV aplica card_interest_rate_bps via Sistema PRICE. Default 1 = só 1x sem juros.';
