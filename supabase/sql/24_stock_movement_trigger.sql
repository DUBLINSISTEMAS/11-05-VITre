-- =====================================================================
-- Mangos Pay — Trigger pra sincronizar cache `stock_quantity` (Fase 4 / ADR-0015)
-- =====================================================================
-- INVARIANTE: cada INSERT em `stock_movement` atualiza atomicamente o
-- cache em `product.stock_quantity` ou `product_variant.stock_quantity`.
-- O trigger AFTER INSERT FOR EACH ROW garante que não há caminho de
-- movement sem cache update.
--
-- COALESCE(stock_quantity, 0) — produtos com track_stock=false podem ter
-- stock_quantity=NULL; o COALESCE trata como 0 antes de somar.
--
-- Aplicar APÓS migration 0017 + SQL 22 + SQL 23.
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_stock_cache_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE product_variant
       SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
     WHERE id = NEW.variant_id;
  ELSE
    UPDATE product
       SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_movement_sync_cache ON "stock_movement";
CREATE TRIGGER stock_movement_sync_cache
  AFTER INSERT ON "stock_movement"
  FOR EACH ROW
  EXECUTE FUNCTION sync_stock_cache_on_movement();
