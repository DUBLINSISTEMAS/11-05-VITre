-- =====================================================================
-- Mangos Pay — RLS para `customer` (Fase 3 / ADR-0014)
-- =====================================================================
-- Como aplicar:
--   1. Rodar primeiro a migration `drizzle/0016_overrated_starhawk.sql`
--      via `pnpm db:migrate`.
--   2. Aplicar SQL 20 (CHECK constraints).
--   3. Colar este arquivo no Supabase Dashboard → SQL Editor → Run.
--
-- O que isso faz:
--   - Habilita RLS na tabela `customer`.
--   - Tenant isolation pelo GUC `app.current_store_id` (mesmo padrão das
--     demais tabelas de domínio).
--   - NÃO há policy `public_read` — diferente de `product_related`,
--     `customer` é entidade INTERNA do admin. Storefront não lê.
--     Confirmação por exclusão: storefront usa
--     `withTenant(storeId, null, ...)` que seta `current_user_id`
--     = 'anonymous'; sem policy permissiva pra anon, anônimo nunca lê
--     nem escreve customer.
-- =====================================================================

ALTER TABLE "customer" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_tenant_isolation ON "customer";
CREATE POLICY customer_tenant_isolation ON "customer"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
