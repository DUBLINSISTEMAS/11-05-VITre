-- =====================================================================
-- Vitrê — Onda C #8 (auditoria 2026-05-19): trigger sync_stock respeita
-- product/variant.track_stock=false
-- =====================================================================
-- Antes (SQL 24): qualquer INSERT em `stock_movement` atualizava
--   product/product_variant.stock_quantity via COALESCE(stock_quantity, 0) + delta.
--   Para produtos `track_stock=false` (estoque ilimitado), `stock_quantity`
--   é semanticamente NULL. Mas se algum caller (manual_in/manual_out de
--   /admin/estoque, bug futuro, restore SQL) inserir um movement nessa
--   entidade, o trigger sobrescrevia o NULL com um número — criando
--   "cache fantasma" que aparece em relatórios como se fosse rastreio
--   real.
--
-- Depois: a função verifica `track_stock` na linha alvo. Se false, faz
--   nothing (o NULL permanece). Se true, atualiza COALESCE como antes.
--
-- Idempotente: CREATE OR REPLACE FUNCTION.
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_stock_cache_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_track boolean;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT track_stock INTO v_track
      FROM product_variant
     WHERE id = NEW.variant_id;
    IF v_track THEN
      UPDATE product_variant
         SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
       WHERE id = NEW.variant_id;
    END IF;
  ELSE
    SELECT track_stock INTO v_track
      FROM product
     WHERE id = NEW.product_id;
    IF v_track THEN
      UPDATE product
         SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
       WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger em si já existe (SQL 24). Não precisa recriar.
