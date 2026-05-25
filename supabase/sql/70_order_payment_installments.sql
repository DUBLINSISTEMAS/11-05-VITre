-- =====================================================================
-- Mangos Pay — Sprint flash (2026-05-24): order_payment.installments
-- =====================================================================
-- CONTEXTO
-- Auditoria do founder identificou bug bloqueante de varejo BR: cliente
-- chega no balcão, pede "vou parcelar em 3x no cartão", sistema só
-- registra "Cartão crédito" sem capturar quantidade de parcelas. Dado
-- comercial básico — perdido em toda venda balcão a crédito.
--
-- DESIGN
-- - Coluna nova `installments smallint not null default 1` em order_payment
-- - Range 1..24 (limite de sanidade — cartões BR vão até 12-18 parcelas
--   na prática)
-- - SOMENTE > 1 quando method='credit'. Outras formas (cash/pix/debit/other)
--   ficam em 1 sempre (CHECK reforça)
-- - Mangos Pay NÃO calcula juros. Apenas registra a escolha. A maquininha
--   do lojista cobra a taxa. (Decisão pragmática pro ICP: lojista do
--   interior combina taxa fora, não quer planilha matemática no sistema)
-- - Default 1 = backfill automático em todas as linhas existentes
--   (cartão histórico = à vista até prova contrária)
--
-- ALTER COLUMN ADD com DEFAULT é metadata-only em PostgreSQL 11+. Sem
-- table scan, sem lock prolongado. Seguro pra rodar em prod com tráfego.
-- =====================================================================

ALTER TABLE order_payment
  ADD COLUMN installments smallint NOT NULL DEFAULT 1;

-- CHECK 1: range válido (1..24)
ALTER TABLE order_payment
  ADD CONSTRAINT order_payment_installments_range
  CHECK (installments >= 1 AND installments <= 24);

-- CHECK 2: parcelas > 1 só em method='credit'.
-- Cash/pix/debit/other são à vista por natureza.
ALTER TABLE order_payment
  ADD CONSTRAINT order_payment_installments_credit_only
  CHECK (installments = 1 OR method = 'credit');

COMMENT ON COLUMN order_payment.installments IS
  'Número de parcelas (cartão de crédito). 1 = à vista. Só > 1 quando method=credit. Mangos Pay registra a escolha — não calcula juros.';
