-- =====================================================================
-- Mangos Pay — Indexes para sustentar escala de catálogo
-- =====================================================================
-- Source of truth: este arquivo. Os indexes parciais e GIN trigram NÃO
-- são declarados em src/db/schema/*.ts porque o Drizzle 0.45 não captura
-- de forma estável `WHERE`-clauses, expressões `LOWER(...)` nem `GIN`
-- trigram. Para evitar drift, drizzle-kit ignora; comentários nos schemas
-- TS apontam de volta pra cá.
--
-- Tudo idempotente (`CREATE INDEX IF NOT EXISTS`, `DROP INDEX IF EXISTS`).
-- Pode rodar 2x sem efeito colateral.
--
-- Aplicado em: prod (Sandra Brito, baixo volume — ALTER seguro).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) pg_trgm extension (necessária para GIN trigram em busca textual)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- 2) product — listing público de catálogo (somente ativos, mais novos primeiro)
--    Cobre `WHERE store_id = $1 AND is_active = true ORDER BY created_at DESC`.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_store_active_created_idx
  ON "product" (store_id, created_at DESC)
  WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 3) product — destaques da home (filtro adicional is_featured)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_featured_active_idx
  ON "product" (store_id, created_at DESC)
  WHERE is_active = true AND is_featured = true;

-- ---------------------------------------------------------------------
-- 4) product — listing por categoria (storefront filtra por category_id)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_store_category_active_idx
  ON "product" (store_id, category_id, created_at DESC)
  WHERE is_active = true;

-- ---------------------------------------------------------------------
-- 5) order — listing admin (`/admin/pedidos`) por loja ordenado por data.
--    Substitui `order_created_idx` (apenas em created_at, sem store_id) que
--    não cobre o caso de uso real. A versão composta é estritamente melhor
--    pro WHERE store_id = $1 ORDER BY created_at DESC do admin.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS order_store_created_idx
  ON "order" (store_id, created_at DESC);

DROP INDEX IF EXISTS order_created_idx;

-- ---------------------------------------------------------------------
-- 6) product.name — busca textual via ILIKE '%...%'
--    GIN trigram em LOWER(name) — case-insensitive, suporta substring match.
--    Parcial em is_active = true (busca admin/storefront só interessa ativos).
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_name_trgm_idx
  ON "product" USING gin (LOWER(name) gin_trgm_ops)
  WHERE is_active = true;
