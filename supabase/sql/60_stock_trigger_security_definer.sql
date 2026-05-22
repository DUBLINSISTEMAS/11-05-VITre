-- =====================================================================
-- Mangos Pay — Onda 1.1 (pré-lojista real, 2026-05-21): trigger sync_stock
-- vira SECURITY DEFINER + falha alto se UPDATE atingir 0 rows.
-- =====================================================================
-- CONTEXTO
-- Auditoria pré-go-live 2026-05-21 identificou que o trigger
-- `sync_stock_cache_on_movement` (SQL 24 + SQL 43) rodava com privilégios
-- do caller. Como o app agora usa `vitre_app NOBYPASSRLS` (SQL 09),
-- qualquer falha de policy no UPDATE de `product` / `product_variant`
-- resultaria em ROW_COUNT=0 silencioso — cache fica defasado da fonte
-- da verdade (`stock_movement`), sintoma reportado pelo founder
-- ("cadastrei com 10, /admin/estoque mostra 0").
--
-- DECISÃO
-- 1) `SECURITY DEFINER` — função roda com privilégios do owner (`postgres`,
--    com BYPASSRLS). UPDATE não passa por policies, sempre atinge a linha
--    alvo. Justificável: a função só faz UPDATE de coluna cache (uso interno
--    de invariante), nunca propaga dados pro caller. Risco controlado.
-- 2) `SET search_path = public` — fixar resolução de nomes elimina vetor
--    clássico de hijack via search_path em funções DEFINER.
-- 3) `GET DIAGNOSTICS ... ROW_COUNT` + `RAISE EXCEPTION` quando 0 linhas
--    afetadas. Falha silenciosa → falha alta + visível. Se algum dia o
--    `product_id` de um movement não existir mais (cascade race futura),
--    a transação inteira aborta em vez de deixar cache divergente.
-- 4) Trigger em si não muda — só substituímos a função (CREATE OR REPLACE).
--
-- IDEMPOTENTE
-- CREATE OR REPLACE FUNCTION + ALTER FUNCTION OWNER + DROP/CREATE TRIGGER.
--
-- DEPENDÊNCIAS
-- SQL 24 (trigger original) e SQL 43 (track_stock awareness) — este SQL
-- substitui ambos no que tange à função. O trigger em si (CREATE TRIGGER
-- stock_movement_sync_cache) continua válido; recriamos pra garantir.
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_stock_cache_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track boolean;
  v_updated integer;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT track_stock INTO v_track
      FROM product_variant
     WHERE id = NEW.variant_id;
    -- Se variante sumiu entre INSERT do movement e este SELECT (race
    -- improvável dentro da mesma tx; possível se algo external mexer),
    -- v_track vira NULL e o IF abaixo é falso — caímos no ELSE final
    -- e abortamos.
    IF v_track IS TRUE THEN
      UPDATE product_variant
         SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
       WHERE id = NEW.variant_id;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 0 THEN
        RAISE EXCEPTION
          'sync_stock_cache_on_movement: 0 rows updated for variant_id=%',
          NEW.variant_id
          USING ERRCODE = 'data_exception';
      END IF;
    ELSIF v_track IS NULL THEN
      RAISE EXCEPTION
        'sync_stock_cache_on_movement: variant_id=% not found',
        NEW.variant_id
        USING ERRCODE = 'data_exception';
    END IF;
    -- v_track = false → variante existe mas não controla estoque.
    -- Nada a fazer (cache permanece NULL conforme decisão SQL 43).
  ELSE
    SELECT track_stock INTO v_track
      FROM product
     WHERE id = NEW.product_id;
    IF v_track IS TRUE THEN
      UPDATE product
         SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_delta
       WHERE id = NEW.product_id;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 0 THEN
        RAISE EXCEPTION
          'sync_stock_cache_on_movement: 0 rows updated for product_id=%',
          NEW.product_id
          USING ERRCODE = 'data_exception';
      END IF;
    ELSIF v_track IS NULL THEN
      RAISE EXCEPTION
        'sync_stock_cache_on_movement: product_id=% not found',
        NEW.product_id
        USING ERRCODE = 'data_exception';
    END IF;
    -- v_track = false → produto existe mas não controla estoque.
    -- Nada a fazer.
  END IF;
  RETURN NEW;
END;
$$;

-- A função foi recriada como SECURITY DEFINER. Garante que o owner é
-- `postgres` (ou outro role com BYPASSRLS), não o caller que aplicou o SQL.
-- Em Supabase, executar este SQL via `postgres` no SQL Editor já preserva
-- a propriedade. Este ALTER é defesa em profundidade pra ambientes locais.
ALTER FUNCTION sync_stock_cache_on_movement() OWNER TO postgres;

-- Trigger continua o mesmo — recriamos pra ficar idempotente.
DROP TRIGGER IF EXISTS stock_movement_sync_cache ON "stock_movement";
CREATE TRIGGER stock_movement_sync_cache
  AFTER INSERT ON "stock_movement"
  FOR EACH ROW
  EXECUTE FUNCTION sync_stock_cache_on_movement();
