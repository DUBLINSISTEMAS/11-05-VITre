-- Sprint 1A Fase 4 — adiciona status 'quote' ao enum de pedido e campo
-- quote_valid_until pra registrar validade do orçamento.
--
-- Orçamento (status='quote'):
--   - Itens registrados normalmente (orderItemTable preenchido)
--   - SEM pagamento (orderPaymentTable não recebe linha)
--   - SEM desconto de estoque (sem stock_movement)
--   - short_code prefixado com 'Q-' (uniqueness preservado pelo retry)
--   - quote_valid_until: typically created_at + 7 days
--
-- Idempotente.

-- 1. Adicionar 'quote' ao enum. Posição: antes de 'awaiting_whatsapp' pra
--    refletir cronologia natural (orçamento vira venda quando lojista fecha).
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'quote' BEFORE 'awaiting_whatsapp';

-- 2. Campo quote_valid_until: validade do orçamento. NULL quando
--    status != 'quote'. App-layer garante a coerência.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS quote_valid_until timestamptz;

COMMENT ON COLUMN "order".quote_valid_until IS
  'Validade do orçamento (typically created_at + 7 days). NULL quando status != quote.';
