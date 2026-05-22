-- =====================================================================
-- Mangos Pay — Sprint 2.4 (2026-05-22): índice trigram em product_variant.name
-- =====================================================================
-- CONTEXTO
-- Loja com variantes (anel "Aro 18", "Aro 20", "Aro 22") sofre busca
-- lenta quando faz ILIKE em product_variant.name. Sem índice trigram,
-- PostgreSQL faz full scan da tabela — fica imperceptível com 100 SKUs,
-- vira problema visível com 5k.
--
-- pg_trgm é extensão padrão Supabase (já habilitada em outras lojas
-- nossas pra product.name). gin_trgm_ops em product_variant.name
-- transforma o ILIKE em index scan.
--
-- DEPLOY
-- 1. CREATE EXTENSION IF NOT EXISTS pg_trgm (idempotente, no-op se já
--    instalada — verificado: já existe na DB).
-- 2. CREATE INDEX CONCURRENTLY pra evitar lock-table durante criação.
--    Como deploy roda sem transação no Editor SQL, CONCURRENTLY é OK.
-- 3. IF NOT EXISTS garante idempotência se a SQL for re-aplicada.
--
-- IMPACTO
-- - Espaço extra: ~10% do tamanho da tabela (típico de GIN trigram).
-- - INSERT/UPDATE em product_variant ficam ~5% mais lentos (assumível,
--   variantes não são hot path).
-- - SELECT com ILIKE em name vira sub-10ms até dezenas de milhares de
--   linhas (vs full scan linear).
--
-- USO
-- src/actions/stock/load.ts:81 — ilike(productVariantTable.name, ...)
-- Outros call sites futuros (PDV picker, relatório margem) ganham
-- automaticamente.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS product_variant_name_trgm_idx
  ON product_variant
  USING gin (name gin_trgm_ops);
