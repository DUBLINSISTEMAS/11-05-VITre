-- Pre-Sprint-6 B — estorno de receivable_payment.
--
-- Problema: lojista digita errado (R$ 100 em vez de R$ 10) e fica preso —
-- receivable_payment é append-only com CHECK amount > 0. Hoje o único
-- caminho de correção é SQL manual no banco.
--
-- Solução append-only respeitando princípio CLAUDE.md 5: correção via
-- lançamento reverso (amount negativo) com FK pra linha original.
--
-- Mudanças:
--   1. CHECK amount_in_cents > 0  →  amount_in_cents <> 0 (permite negativo)
--   2. Nova coluna reversal_of_id uuid FK self-referência pro pagamento
--      original. NULL = pagamento normal. NOT NULL = estorno.
--   3. UNIQUE parcial: cada payment original só pode ter UM estorno
--      (impede double-reversal por race condition mesmo sem advisory
--      lock; defesa em profundidade).
--
-- Idempotente.

-- =====================================================================
-- 1. Relaxa CHECK pra permitir amount negativo
-- =====================================================================
ALTER TABLE "receivable_payment"
  DROP CONSTRAINT IF EXISTS receivable_payment_amount_positive;

-- Mantém o nome antigo no constraint pra histórico, mas semântica nova:
-- "amount não-zero" (positivo = pagamento, negativo = estorno).
ALTER TABLE "receivable_payment"
  DROP CONSTRAINT IF EXISTS receivable_payment_amount_nonzero;
ALTER TABLE "receivable_payment"
  ADD CONSTRAINT receivable_payment_amount_nonzero
  CHECK (amount_in_cents <> 0);

-- =====================================================================
-- 2. Coluna reversal_of_id
-- =====================================================================
ALTER TABLE "receivable_payment"
  ADD COLUMN IF NOT EXISTS "reversal_of_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receivable_payment_reversal_of_fk'
  ) THEN
    ALTER TABLE "receivable_payment"
      ADD CONSTRAINT receivable_payment_reversal_of_fk
      FOREIGN KEY (reversal_of_id)
      REFERENCES "receivable_payment"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- 3. Defesa contra double-reversal: cada original tem no máx 1 estorno.
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS receivable_payment_reversal_unique
  ON "receivable_payment"("reversal_of_id")
  WHERE reversal_of_id IS NOT NULL;

-- =====================================================================
-- 4. Invariantes adicionais (CHECKs):
--    - Estorno tem amount < 0 (sinaliza visualmente que é saída).
--    - Não-estorno tem amount > 0 (pagamento normal).
-- =====================================================================
ALTER TABLE "receivable_payment"
  DROP CONSTRAINT IF EXISTS receivable_payment_reversal_sign;
ALTER TABLE "receivable_payment"
  ADD CONSTRAINT receivable_payment_reversal_sign
  CHECK (
    (reversal_of_id IS NULL AND amount_in_cents > 0)
    OR
    (reversal_of_id IS NOT NULL AND amount_in_cents < 0)
  );
