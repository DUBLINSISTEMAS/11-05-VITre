-- =====================================================================
-- Mangos Pay — Migration #82: Ressignificação Bloco B
--   kind enum + snapshots de fee/commission/late_fee + settlement days
-- =====================================================================
-- CONTEXTO
-- Bloco B da ressignificação 2026-05-27 (docs/RESSIGNIFICACAO-ADMIN.md):
-- fundação invisível pra lucro líquido REAL por transação. Sem isso, o
-- helper canônico `calculateNetProfit` não tem ingredientes pra calcular
-- nem o dashboard pra mostrar resultado honesto da semana/mês.
--
-- 5 frentes:
--
-- 1. product.kind enum — distingue 3 universos:
--    'raw_material'   = matéria-prima, mostruário, ativo (joalheria: ouro
--                       18k em barra). Custo + estoque, NÃO vende em canal.
--    'finished_good'  = produto comercializável (default — 100% compat).
--    'service'        = serviço (ex: limpeza de joia, instalação).
--    Default 'finished_good' preserva todos os produtos atuais. Filtros
--    UI passam a guiar cadastro por intenção.
--
-- 2. store.settlement_days_{pix,debit,credit} — quando o dinheiro CAI
--    na conta. PIX D+0, débito D+1, crédito D+30 (defaults médios
--    Stone/Cielo 2025). Lojista ajusta em /admin/pagamento conforme
--    contrato real. Desbloqueia "Fluxo de caixa real" futuro sem migration
--    nova. Range 0..90 dias.
--
-- 3. order_payment.card_fee_snapshot_in_cents — taxa REAL em centavos
--    descontada naquela linha de pagamento (calculada de
--    store.card_real_fee_bps_* no momento da venda). Sem snapshot,
--    lojista que muda taxa em junho vê DRE de fevereiro mentir.
--    NULL pra cash/pix (sem taxa). Calculado no app via helper canônico.
--
-- 4. order_payment.settlement_date — data calculada de quando o valor
--    cai na conta (createdAt + settlement_days do método). Permite
--    "essa semana eu recebi R$ X, mas só R$ Y cai sexta — R$ Z chega
--    espalhado em fevereiro". Calculado no INSERT pelo app-layer.
--    NULL pra cash (já entrou em caixa).
--
-- 5. order_item.commission_snapshot_in_cents — comissão da vendedora
--    naquela linha em centavos. NULL pra ordens sem seller_id ou produtos
--    sem default_commission_bps. Salva relatório retroativo quando
--    lojista ajusta % comissão depois.
--
-- 6. receivable_payment.late_fee_applied_in_cents + interest_applied_in_cents
--    — multa e juros REAIS cobrados naquela linha de pagamento, em centavos
--    (não bps). Lojista olha extrato e lê "R$ 50 de multa, R$ 12 de juros"
--    direto, sem reverse-engineering de bps + datas. NULL pra pagamentos
--    em dia ou pagamento normal antes de SQL 78.
--
-- BACKFILL
-- Nada. Todos snapshots ficam NULL pra histórico. Vendas/pagamentos novos
-- preenchem via app-layer. Relatórios tratam NULL como "informação
-- ausente" (mostra "—" ou pula a linha), nunca como zero.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DO block pra enum + DROP
-- CONSTRAINT IF EXISTS antes do ADD CONSTRAINT.
-- =====================================================================

-- 1. ENUM product_kind ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_kind') THEN
    CREATE TYPE product_kind AS ENUM ('raw_material', 'finished_good', 'service');
  END IF;
END $$;

-- 2. product.kind ----------------------------------------------------
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS kind product_kind NOT NULL DEFAULT 'finished_good';

CREATE INDEX IF NOT EXISTS product_store_kind_idx
  ON product (store_id, kind);

COMMENT ON COLUMN product.kind IS
  'Universo do produto: raw_material (matéria-prima/ativo, NÃO vende em canal), finished_good (comercializável — default), service. Default preserva compat com produtos existentes (todos viram finished_good no backfill implícito do NOT NULL DEFAULT).';

-- 3. store.settlement_days_{pix,debit,credit} ----------------------------
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_pix integer NOT NULL DEFAULT 0;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_debit integer NOT NULL DEFAULT 1;
ALTER TABLE store
  ADD COLUMN IF NOT EXISTS settlement_days_credit integer NOT NULL DEFAULT 30;

ALTER TABLE store DROP CONSTRAINT IF EXISTS store_settlement_days_range;
ALTER TABLE store ADD CONSTRAINT store_settlement_days_range
  CHECK (
    settlement_days_pix BETWEEN 0 AND 90
    AND settlement_days_debit BETWEEN 0 AND 90
    AND settlement_days_credit BETWEEN 0 AND 90
  );

COMMENT ON COLUMN store.settlement_days_pix IS
  'Dias até PIX cair na conta. Default 0 (D+0). Range 0..90. Usado pra calcular order_payment.settlement_date.';
COMMENT ON COLUMN store.settlement_days_debit IS
  'Dias até débito cair na conta. Default 1 (D+1 padrão maquininha). Range 0..90.';
COMMENT ON COLUMN store.settlement_days_credit IS
  'Dias até crédito cair na conta. Default 30 (D+30 padrão maquininha sem antecipação). Range 0..90.';

-- 4. order_payment.card_fee_snapshot_in_cents + settlement_date ----------
ALTER TABLE order_payment
  ADD COLUMN IF NOT EXISTS card_fee_snapshot_in_cents integer;
ALTER TABLE order_payment
  ADD COLUMN IF NOT EXISTS settlement_date date;

ALTER TABLE order_payment DROP CONSTRAINT IF EXISTS order_payment_card_fee_nonneg;
ALTER TABLE order_payment ADD CONSTRAINT order_payment_card_fee_nonneg
  CHECK (card_fee_snapshot_in_cents IS NULL OR card_fee_snapshot_in_cents >= 0);

COMMENT ON COLUMN order_payment.card_fee_snapshot_in_cents IS
  'Taxa real cobrada pela maquininha NESTA linha de pagamento em centavos. Snapshot — fica fixo mesmo se lojista mudar store.card_real_fee_bps_* depois. NULL pra cash/pix/other.';
COMMENT ON COLUMN order_payment.settlement_date IS
  'Data calculada de quando o valor cai na conta (createdAt + store.settlement_days do método). NULL pra cash. Permite calcular fluxo de caixa real (a receber por período).';

-- 5. order_item.commission_snapshot_in_cents ----------------------------
ALTER TABLE order_item
  ADD COLUMN IF NOT EXISTS commission_snapshot_in_cents integer;

ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_commission_nonneg;
ALTER TABLE order_item ADD CONSTRAINT order_item_commission_nonneg
  CHECK (commission_snapshot_in_cents IS NULL OR commission_snapshot_in_cents >= 0);

COMMENT ON COLUMN order_item.commission_snapshot_in_cents IS
  'Comissão da vendedora calculada nesta linha em centavos. NULL pra orders sem seller_id ou produtos sem default_commission_bps. Snapshot — fica fixo mesmo se lojista ajustar % depois.';

-- 6. receivable_payment.late_fee_applied + interest_applied -------------
ALTER TABLE receivable_payment
  ADD COLUMN IF NOT EXISTS late_fee_applied_in_cents integer;
ALTER TABLE receivable_payment
  ADD COLUMN IF NOT EXISTS interest_applied_in_cents integer;

ALTER TABLE receivable_payment DROP CONSTRAINT IF EXISTS receivable_payment_fees_nonneg;
ALTER TABLE receivable_payment ADD CONSTRAINT receivable_payment_fees_nonneg
  CHECK (
    (late_fee_applied_in_cents IS NULL OR late_fee_applied_in_cents >= 0)
    AND (interest_applied_in_cents IS NULL OR interest_applied_in_cents >= 0)
  );

COMMENT ON COLUMN receivable_payment.late_fee_applied_in_cents IS
  'Multa REAL cobrada nesta linha de pagamento em centavos. NULL pra pagamento em dia ou linha pré-SQL 78. Permite extrato "R$ 50 de multa" sem reverse de bps.';
COMMENT ON COLUMN receivable_payment.interest_applied_in_cents IS
  'Juros REAIS cobrados em centavos. NULL pra pagamento em dia. Calculado em app: principal × interest_per_month_bps × meses_atraso / 10000.';
