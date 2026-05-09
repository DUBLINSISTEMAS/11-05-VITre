-- =====================================================================
-- Vitrê — Setup de RLS (Row-Level Security)
-- =====================================================================
-- Como aplicar:
--   1. As tabelas já existem (drizzle migrate aplicou).
--   2. Abra Supabase Dashboard → SQL Editor → cole este arquivo → Run.
--   3. Confirme aplicação rodando `npm run db:check` no terminal.
--
-- O que isso faz:
--   - DESABILITA RLS nas tabelas Better Auth (gerencia segurança internamente).
--   - Mantém RLS ATIVA nas tabelas de domínio (Supabase já habilitou
--     automaticamente via "Enable automatic RLS").
--   - Cria policies que isolam tenants pelo GUC `app.current_store_id`.
--   - Cria policies de leitura pública para o storefront (anônimo).
--
-- Modelo de defesa (importante — leia ADR-0001):
--   1ª linha: app-layer (`withTenant()` em Drizzle) — disciplina obrigatória.
--   2ª linha: RLS — protege contra acesso via supabase-js anônimo direto.
--   Nossa conexão Drizzle usa role `postgres` (bypass RLS). FORCE RLS com
--   role custom é roadmap pós-MVP.
--
-- Referências: docs/decisoes/0001-multi-tenant-rls-postgres.md
-- =====================================================================

-- ============================================================
-- 0. BETTER AUTH — desabilitar RLS (auth.* gerencia internamente)
-- ============================================================
ALTER TABLE "user"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE session       DISABLE ROW LEVEL SECURITY;
ALTER TABLE account       DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification  DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. STORE — usuário acessa apenas suas próprias lojas
-- ============================================================
DROP POLICY IF EXISTS store_owner_access ON store;
CREATE POLICY store_owner_access ON store
  FOR ALL
  USING (owner_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS store_public_read_active ON store;
CREATE POLICY store_public_read_active ON store
  FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 2. CATEGORY
-- ============================================================
DROP POLICY IF EXISTS category_tenant_isolation ON category;
CREATE POLICY category_tenant_isolation ON category
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS category_public_read_active ON category;
CREATE POLICY category_public_read_active ON category
  FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 3. PRODUCT
-- ============================================================
DROP POLICY IF EXISTS product_tenant_isolation ON product;
CREATE POLICY product_tenant_isolation ON product
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS product_public_read_active ON product;
CREATE POLICY product_public_read_active ON product
  FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 4. PRODUCT_IMAGE
-- ============================================================
DROP POLICY IF EXISTS product_image_tenant_isolation ON product_image;
CREATE POLICY product_image_tenant_isolation ON product_image
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS product_image_public_read ON product_image;
CREATE POLICY product_image_public_read ON product_image
  FOR SELECT
  USING (true);

-- ============================================================
-- 5. PRODUCT_VARIANT
-- ============================================================
DROP POLICY IF EXISTS variant_tenant_isolation ON product_variant;
CREATE POLICY variant_tenant_isolation ON product_variant
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS variant_public_read_active ON product_variant;
CREATE POLICY variant_public_read_active ON product_variant
  FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 6. BANNER
-- ============================================================
DROP POLICY IF EXISTS banner_tenant_isolation ON banner;
CREATE POLICY banner_tenant_isolation ON banner
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS banner_public_read_active ON banner;
CREATE POLICY banner_public_read_active ON banner
  FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 7. ORDER
-- ============================================================
DROP POLICY IF EXISTS order_tenant_isolation ON "order";
CREATE POLICY order_tenant_isolation ON "order"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

DROP POLICY IF EXISTS order_anonymous_insert ON "order";
CREATE POLICY order_anonymous_insert ON "order"
  FOR INSERT
  WITH CHECK (
    store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  );

DROP POLICY IF EXISTS order_public_read_by_code ON "order";
-- Pedido público é resolvido somente pelo server via public_token opaco.
-- Não exponha SELECT anônimo direto em "order": contém PII do cliente.

-- ============================================================
-- 8. ORDER_ITEM — só acessa via order
-- ============================================================
DROP POLICY IF EXISTS order_item_tenant_access ON order_item;
CREATE POLICY order_item_tenant_access ON order_item
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = order_item.order_id
        AND o.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS order_item_public_read ON order_item;
-- Itens públicos são servidos pela aplicação junto do pedido sanitizado.
-- Não exponha SELECT anônimo direto: a relação com order pode vazar PII.

-- =====================================================================
-- Verificação final — execute para validar
-- =====================================================================
SELECT schemaname, tablename, policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
