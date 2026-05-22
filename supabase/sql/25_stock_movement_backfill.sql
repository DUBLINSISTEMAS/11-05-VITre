-- =====================================================================
-- Mangos Pay — Backfill de stock_movement (Fase 4 / ADR-0015)
-- =====================================================================
-- Cria 1 movement do tipo `initial` pra cada produto/variant com
-- track_stock=true e stock_quantity > 0.
--
-- ATENÇÃO — DOUBLE COUNTING:
--   O trigger `stock_movement_sync_cache` (SQL 24) soma `quantity_delta`
--   no `stock_quantity` cacheado. Como o backfill insere
--   `quantity_delta = stock_quantity ATUAL`, o trigger DOBRARIA o cache.
--   Solução: DISABLE TRIGGER antes do INSERT, ENABLE depois. Cache é
--   preservado intacto. Novos movements pós-backfill funcionam normal.
--
-- Idempotência: WHERE NOT EXISTS garante que rodar 2x não duplica.
--
-- Aplicar APÓS migration 0017 + SQL 22 + SQL 23 + SQL 24.
-- =====================================================================

ALTER TABLE "stock_movement" DISABLE TRIGGER "stock_movement_sync_cache";

-- Produtos com track_stock + saldo > 0 e SEM variantes rastreadas próprias
-- (se o produto tem variantes que rastreiam, o saldo "do produto" é
-- agregado caso de borda — aqui cria 1 initial por produto pra preservar
-- o que existe; mesmo critério dos UPDATE-paths atuais).
INSERT INTO "stock_movement" (
  "store_id", "product_id", "variant_id", "movement_type",
  "quantity_delta", "notes"
)
SELECT
  p."store_id", p."id", NULL, 'initial'::stock_movement_type,
  p."stock_quantity", 'Saldo inicial — migração ADR-0015'
  FROM "product" p
 WHERE p."track_stock" = true
   AND p."stock_quantity" IS NOT NULL
   AND p."stock_quantity" > 0
   AND NOT EXISTS (
     SELECT 1 FROM "stock_movement" m
      WHERE m."product_id" = p."id"
        AND m."variant_id" IS NULL
        AND m."movement_type" = 'initial'
   );

INSERT INTO "stock_movement" (
  "store_id", "product_id", "variant_id", "movement_type",
  "quantity_delta", "notes"
)
SELECT
  v."store_id", v."product_id", v."id", 'initial'::stock_movement_type,
  v."stock_quantity", 'Saldo inicial — migração ADR-0015'
  FROM "product_variant" v
 WHERE v."track_stock" = true
   AND v."stock_quantity" IS NOT NULL
   AND v."stock_quantity" > 0
   AND NOT EXISTS (
     SELECT 1 FROM "stock_movement" m
      WHERE m."variant_id" = v."id"
        AND m."movement_type" = 'initial'
   );

ALTER TABLE "stock_movement" ENABLE TRIGGER "stock_movement_sync_cache";
