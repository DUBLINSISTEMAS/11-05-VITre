-- =====================================================================
-- Mangos Pay — Multa + juros em fiado (S3.2 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- Lojista BR cobra multa (~2%) + juros (~1%/mês) em fiado vencido. Hoje
-- o sistema aceita o pagamento integral SEM cobrar multa nem juros — em
-- loja com 100 fiados/mês = ~R$ 1.200 perdidos por mês silenciosos.
--
-- DESIGN
-- Campos novos em `receivable`:
--   late_fee_bps (smallint default 200 = 2%, range 0..9999)
--   interest_per_month_bps (smallint default 100 = 1%/mês, range 0..9999)
--
-- Cálculo (em app, não em DB):
--   meses_atraso = (now() - due_date) em meses fracionários
--   multa = principal * late_fee_bps / 10000  (uma vez só, quando atrasa)
--   juros = principal * interest_per_month_bps * meses_atraso / 10000
--   total_atual = principal + multa + juros
--
-- Recebimento parcial abate primeiro JUROS, depois MULTA, depois PRINCIPAL
-- (regra padrão BR; quem decide é o app no recordReceivablePayment).
--
-- Defaults da loja: store.receivable_default_late_fee_bps +
-- store.receivable_default_interest_bps (preenchidos no /admin/pagamento).
-- Receivable pode override via update.
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS.
-- =====================================================================

-- 1. Colunas em store (defaults globais por loja)
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS receivable_default_late_fee_bps integer NOT NULL DEFAULT 200;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS receivable_default_interest_bps integer NOT NULL DEFAULT 100;

ALTER TABLE store
  DROP CONSTRAINT IF EXISTS store_receivable_fees_range;
ALTER TABLE store
  ADD CONSTRAINT store_receivable_fees_range
  CHECK (
    receivable_default_late_fee_bps BETWEEN 0 AND 9999
    AND receivable_default_interest_bps BETWEEN 0 AND 9999
  );

-- 2. Colunas em receivable (override por receivable, herda do store se NULL)
ALTER TABLE receivable
  ADD COLUMN IF NOT EXISTS late_fee_bps integer;

ALTER TABLE receivable
  ADD COLUMN IF NOT EXISTS interest_per_month_bps integer;

ALTER TABLE receivable
  DROP CONSTRAINT IF EXISTS receivable_fees_range;
ALTER TABLE receivable
  ADD CONSTRAINT receivable_fees_range
  CHECK (
    (late_fee_bps IS NULL OR (late_fee_bps BETWEEN 0 AND 9999))
    AND (interest_per_month_bps IS NULL OR (interest_per_month_bps BETWEEN 0 AND 9999))
  );

COMMENT ON COLUMN store.receivable_default_late_fee_bps IS
  'Multa default de fiado em bps (200 = 2%). Lojista ajusta em /admin/pagamento. CHECK 0..9999.';
COMMENT ON COLUMN store.receivable_default_interest_bps IS
  'Juros default de fiado em bps/mês (100 = 1%/mês). CHECK 0..9999.';
COMMENT ON COLUMN receivable.late_fee_bps IS
  'Override de multa do receivable. NULL = herda de store.receivable_default_late_fee_bps.';
COMMENT ON COLUMN receivable.interest_per_month_bps IS
  'Override de juros mensal. NULL = herda do store.';
