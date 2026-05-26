-- =====================================================================
-- Mangos Pay — Lote + validade em compra (S3.4 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- Perfumaria/cosmético vende produto com validade. Sem rastrear lote
-- + expires_at, lojista vende vencido (multa Vigilância Sanitária) ou
-- descarta lote válido (perda). Hoje schema não suporta.
--
-- DESIGN
-- Lote é atributo da COMPRA (purchase_item), não do produto:
-- mesma SKU pode ter múltiplos lotes simultâneos com validades diferentes.
-- FEFO (First-Expired-First-Out) é a regra padrão BR.
--
-- - batch_number text nullable (texto livre que o lojista anota da NF)
-- - expires_at date nullable
-- - CHECK length <= 60 no batch (cabe códigos típicos de lote)
--
-- Category opt-in via category.tracks_batch boolean default false. UI
-- só mostra os campos quando categoria do produto pede.
--
-- Dashboard "Vencendo em 60 dias": SELECT purchase_item WHERE
-- expires_at < now() + 60d AND restante > 0 (qty restante via
-- stock_movement.purchase_item_id já existe em SQL 52).
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS.
-- =====================================================================

-- 1. purchase_item — campos de lote
ALTER TABLE purchase_item
  ADD COLUMN IF NOT EXISTS batch_number text;

ALTER TABLE purchase_item
  ADD COLUMN IF NOT EXISTS expires_at date;

ALTER TABLE purchase_item
  DROP CONSTRAINT IF EXISTS purchase_item_batch_length;
ALTER TABLE purchase_item
  ADD CONSTRAINT purchase_item_batch_length
  CHECK (batch_number IS NULL OR length(batch_number) <= 60);

-- Index pra dashboard "Vencendo em 60 dias".
CREATE INDEX IF NOT EXISTS purchase_item_expires_at_idx
  ON purchase_item (expires_at)
  WHERE expires_at IS NOT NULL;

-- 2. category — flag tracks_batch (categoria opt-in pra UI mostrar campos)
ALTER TABLE category
  ADD COLUMN IF NOT EXISTS tracks_batch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN purchase_item.batch_number IS
  'Número de lote da NF do fornecedor. Texto livre, até 60 chars. NULL = lote não rastreado.';

COMMENT ON COLUMN purchase_item.expires_at IS
  'Data de validade do lote. NULL = sem validade (produto não-perecível).';

COMMENT ON COLUMN category.tracks_batch IS
  'Quando true, UI de compra exibe campos batch_number + expires_at obrigatórios. Default false (joalheria, roupa).';
