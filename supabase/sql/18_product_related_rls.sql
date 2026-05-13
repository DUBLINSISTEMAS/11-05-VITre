-- =====================================================================
-- Vitrê — RLS para product_related (Onda 4 — 2026-05-13)
-- =====================================================================
-- Como aplicar:
--   1. Rodar primeiro a migration `drizzle/0012_hesitant_spitfire.sql`
--      via `pnpm db:migrate` OU paste manual no SQL Editor.
--   2. Depois colar este arquivo no Supabase Dashboard → SQL Editor → Run.
--
-- O que isso faz:
--   - Habilita RLS na tabela product_related.
--   - Tenant isolation pelo GUC `app.current_store_id` (mesmo padrão das
--     demais tabelas de catálogo).
--   - Leitura pública via SELECT (storefront mostra "Você pode gostar
--     também" anonimamente). Tabela em si não vaza PII — só pares de
--     UUIDs ligando produtos da mesma loja.
-- =====================================================================

ALTER TABLE product_related ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_related_tenant_isolation ON product_related;
CREATE POLICY product_related_tenant_isolation ON product_related
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS product_related_public_read ON product_related;
CREATE POLICY product_related_public_read ON product_related
  FOR SELECT
  USING (true);
