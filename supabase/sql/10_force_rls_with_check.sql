-- =====================================================================
-- Mangos Pay — Onda C / Step 2: FORCE RLS + WITH CHECK em todas tabelas
-- =====================================================================
-- Aplicar APÓS 09_app_role_setup.sql (depende da role vitre_app existir
-- e ser a usada pelo `DATABASE_URL` da app — postgres ainda bypassa RLS,
-- por isso o passo 1 é mandatório).
--
-- O que muda:
--   1. ALTER TABLE ... FORCE ROW LEVEL SECURITY — RLS passa a valer
--      MESMO para o owner da tabela (postgres incluso). Combinado com
--      vitre_app NOBYPASSRLS, isso fecha a porta dos fundos.
--   2. Reescreve policies de tenant_isolation com `WITH CHECK` igual a
--      `USING`. Sem isso, INSERT/UPDATE poderiam injetar `store_id` de
--      outro tenant (USING só filtra leitura/UPDATE-existing).
--
-- Ao rodar este script, a role `postgres` ainda funciona (porque temos
-- DIRECT_URL pra migrations), MAS qualquer query de aplicação SEM o GUC
-- `app.current_store_id` setado vai voltar zero linhas. Ou seja: depois
-- deste script, todo código que ainda use `db.*` direto sem `withTenant`
-- VAI QUEBRAR. Isso é proposital — força a disciplina prometida em ADR-0001.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. FORCE ROW LEVEL SECURITY em todas tabelas de domínio
-- ---------------------------------------------------------------------
ALTER TABLE store           FORCE ROW LEVEL SECURITY;
ALTER TABLE category        FORCE ROW LEVEL SECURITY;
ALTER TABLE product         FORCE ROW LEVEL SECURITY;
ALTER TABLE product_image   FORCE ROW LEVEL SECURITY;
ALTER TABLE product_variant FORCE ROW LEVEL SECURITY;
ALTER TABLE banner          FORCE ROW LEVEL SECURITY;
ALTER TABLE "order"         FORCE ROW LEVEL SECURITY;
ALTER TABLE order_item      FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- B. Reescrever policies com WITH CHECK
-- ---------------------------------------------------------------------

-- 1. STORE — owner only, leitura pública para is_active.
DROP POLICY IF EXISTS store_owner_access ON store;
CREATE POLICY store_owner_access ON store
  FOR ALL
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));

-- store_public_read_active fica como está (SELECT-only, não precisa WITH CHECK).

-- 2. CATEGORY
DROP POLICY IF EXISTS category_tenant_isolation ON category;
CREATE POLICY category_tenant_isolation ON category
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- 3. PRODUCT
DROP POLICY IF EXISTS product_tenant_isolation ON product;
CREATE POLICY product_tenant_isolation ON product
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- 4. PRODUCT_IMAGE
DROP POLICY IF EXISTS product_image_tenant_isolation ON product_image;
CREATE POLICY product_image_tenant_isolation ON product_image
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- 5. PRODUCT_VARIANT
DROP POLICY IF EXISTS variant_tenant_isolation ON product_variant;
CREATE POLICY variant_tenant_isolation ON product_variant
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- 6. BANNER
DROP POLICY IF EXISTS banner_tenant_isolation ON banner;
CREATE POLICY banner_tenant_isolation ON banner
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- 7. ORDER — admin via tenant_isolation; INSERT anônimo continua aberto via order_anonymous_insert.
DROP POLICY IF EXISTS order_tenant_isolation ON "order";
CREATE POLICY order_tenant_isolation ON "order"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- order_anonymous_insert (já tem WITH CHECK) fica como está em 01_rls_setup.sql.

-- Anônimo pode marcar `whatsapp_opened_at` no próprio pedido via publicToken.
-- Conhecimento do publicToken (32 chars opacos) já é a prova de posse. Restrito
-- a esse campo apenas — qualquer outro UPDATE bate em order_tenant_isolation.
DROP POLICY IF EXISTS order_public_mark_whatsapp_opened ON "order";
CREATE POLICY order_public_mark_whatsapp_opened ON "order"
  FOR UPDATE
  USING (current_setting('app.current_user_id', true) = 'anonymous')
  WITH CHECK (current_setting('app.current_user_id', true) = 'anonymous');

-- 8. ORDER_ITEM — acesso via order. Adiciona WITH CHECK simétrico.
DROP POLICY IF EXISTS order_item_tenant_access ON order_item;
CREATE POLICY order_item_tenant_access ON order_item
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = order_item.order_id
        AND o.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = order_item.order_id
        AND o.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  );

-- ---------------------------------------------------------------------
-- C. Verificação — rode depois de apply
-- ---------------------------------------------------------------------
SELECT
  schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Confirma FORCE RLS:
SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
 WHERE relname IN (
   'store','category','product','product_image','product_variant',
   'banner','order','order_item'
 )
 ORDER BY relname;
-- Esperado: relrowsecurity=t, relforcerowsecurity=t para todas.
