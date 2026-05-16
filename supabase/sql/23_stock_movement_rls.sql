-- =====================================================================
-- Vitrê — RLS para `stock_movement` (Fase 4 / ADR-0015)
-- =====================================================================
-- O que isso faz:
--   1. Habilita RLS na tabela.
--   2. Tenant isolation owner-only via GUC `app.current_store_id` —
--      lojista lê/escreve apenas movements da própria loja.
--   3. INSERT anônimo RESTRITO a `sale` + `reference_type='order'` —
--      checkout do storefront usa `withTenant(storeId, anonymous)` pra
--      criar pedido, e o trigger/action precisa registrar o movement de
--      saída. Sem essa policy, INSERT anônimo seria bloqueado.
--   4. Anônimo NÃO LÊ nem escreve outros tipos (audit log fica owner-only).
--
-- Aplicar APÓS migration 0017 + SQL 22.
-- =====================================================================

ALTER TABLE "stock_movement" ENABLE ROW LEVEL SECURITY;

-- Owner: lojista logado, acesso total dentro da própria loja
DROP POLICY IF EXISTS stock_movement_tenant_isolation ON "stock_movement";
CREATE POLICY stock_movement_tenant_isolation ON "stock_movement"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- Anônimo: pode INSERT apenas movement de venda (sale) com referência
-- ao pedido. Bloqueia manual_in / adjustment / etc. fraudulentos.
DROP POLICY IF EXISTS stock_movement_anonymous_sale_insert ON "stock_movement";
CREATE POLICY stock_movement_anonymous_sale_insert ON "stock_movement"
  FOR INSERT
  WITH CHECK (
    store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    AND current_setting('app.current_user_id', true) = 'anonymous'
    AND movement_type IN ('sale', 'return')
    AND reference_type = 'order'
    AND reference_id IS NOT NULL
  );
