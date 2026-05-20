-- Sprint 3 — permitir reference_type='purchase' em stock_movement.
--
-- Toda entrada de mercadoria (purchase_item INSERT) gera um stock_movement
-- type='manual_in' com reference_type='purchase' + reference_id=purchase.id.
-- Pattern espelha 'order' (que já existe) — auditoria + rastreabilidade.
--
-- CHECK original (SQL 22) aceita apenas 'order' e 'manual'. Estendendo
-- pra incluir 'purchase'. Idempotente.

ALTER TABLE "stock_movement"
  DROP CONSTRAINT IF EXISTS stock_movement_reference_consistency;

ALTER TABLE "stock_movement"
  ADD CONSTRAINT stock_movement_reference_consistency
  CHECK (
    (reference_type IS NULL AND reference_id IS NULL)
    OR (
      reference_type = ANY (ARRAY['order'::text, 'manual'::text, 'purchase'::text])
      AND reference_id IS NOT NULL
    )
  );
