-- Sprint 4A — receivable_payment append-only.
--
-- Permite pagamento PARCIAL de fiado (cliente deve R$ 300, paga R$ 100
-- hoje + R$ 200 depois). Hoje o fluxo `markReceivablePaid` é boolean:
-- quita-tudo-ou-nada. Em loja real, parcial é o caso comum.
--
-- Modelo:
--   1 receivable -> N receivable_payment (append-only)
--   receivable.paid_at é DERIVADO:
--     paid_at NULL                     enquanto SUM(payments) < amount
--     paid_at = MAX(p.created_at)      quando SUM(payments) >= amount
--
-- App-layer (action recordReceivablePayment) cuida da derivação. Trigger
-- DB rejeitado pra preservar visibilidade/testabilidade (princípio
-- CLAUDE.md 5/7).
--
-- Append-only: SEM UPDATE. SEM DELETE. Correção = lançamento reverso
-- (amount negativo) — mas CHECK > 0 garante que pagamento normal nunca
-- vira "estorno acidental"; estorno usa coluna `reversal_of` futura
-- (Sprint 4 não inclui — só append + parcial básico).
--
-- Idempotente.

-- =====================================================================
-- Tabela
-- =====================================================================
CREATE TABLE IF NOT EXISTS "receivable_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant denormalizado pra simplificar RLS (mesmo padrão de
  -- order_payment). Index store_id + created_at acelera relatório
  -- "entradas de fiado no mês".
  "store_id" uuid NOT NULL REFERENCES "store"("id") ON DELETE CASCADE,

  -- Pagamento pertence a UM receivable. ON DELETE CASCADE: se o fiado
  -- for excluído administrativamente, payments somem junto (em app
  -- nunca chamamos DELETE — protege contra órfãos se acontecer).
  "receivable_id" uuid NOT NULL
    REFERENCES "receivable"("id") ON DELETE CASCADE,

  -- Valor pago. CHECK > 0 — pagamento zero não tem semântica.
  "amount_in_cents" integer NOT NULL,

  -- Forma usada pra quitar. Reusa enum de order_payment_method.
  "method" order_payment_method NOT NULL,

  -- Notas livre (cheque #, vale, observação). Max 500 igual receivable.notes.
  "notes" text,

  -- Quem registrou. NOT NULL: pagamento sempre por humano logado.
  "created_by_user_id" text NOT NULL REFERENCES "user"("id"),

  "created_at" timestamp NOT NULL DEFAULT now()
);

-- =====================================================================
-- CHECK constraints
-- =====================================================================
ALTER TABLE "receivable_payment"
  DROP CONSTRAINT IF EXISTS receivable_payment_amount_positive;
ALTER TABLE "receivable_payment"
  ADD CONSTRAINT receivable_payment_amount_positive
  CHECK (amount_in_cents > 0);

ALTER TABLE "receivable_payment"
  DROP CONSTRAINT IF EXISTS receivable_payment_notes_length;
ALTER TABLE "receivable_payment"
  ADD CONSTRAINT receivable_payment_notes_length
  CHECK (notes IS NULL OR char_length(notes) <= 500);

-- =====================================================================
-- Indexes
-- =====================================================================
-- Hot path 1: drilldown de um receivable -> lista de pagamentos.
CREATE INDEX IF NOT EXISTS receivable_payment_receivable_idx
  ON "receivable_payment"("receivable_id", "created_at");

-- Hot path 2: relatório "entradas de fiado no período X" (Sprint 5).
CREATE INDEX IF NOT EXISTS receivable_payment_store_created_idx
  ON "receivable_payment"("store_id", "created_at");

-- =====================================================================
-- RLS — pattern idêntico a order_payment / receivable.
-- =====================================================================
ALTER TABLE "receivable_payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receivable_payment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receivable_payment_tenant_isolation ON "receivable_payment";
CREATE POLICY receivable_payment_tenant_isolation ON "receivable_payment"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
