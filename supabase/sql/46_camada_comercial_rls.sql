-- ADR-0034 Camada 1 — RLS pra todas as tabelas comerciais novas.
-- Padrão `tenant_isolation` por `store_id` (igual customer, supplier, etc.).
-- order_payment herda via JOIN order.store_id pra manter consistência.
-- Idempotente (DROP POLICY IF EXISTS antes de criar).

-- =====================================================================
-- order_payment — herda store_id (poderia ser via JOIN com order, mas
-- mantemos store_id direto na tabela pra simplicidade + performance).
-- =====================================================================
ALTER TABLE "order_payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_payment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_payment_tenant_isolation ON "order_payment";
CREATE POLICY order_payment_tenant_isolation ON "order_payment"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- =====================================================================
-- supplier
-- =====================================================================
ALTER TABLE "supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_tenant_isolation ON "supplier";
CREATE POLICY supplier_tenant_isolation ON "supplier"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- =====================================================================
-- purchase
-- =====================================================================
ALTER TABLE "purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_tenant_isolation ON "purchase";
CREATE POLICY purchase_tenant_isolation ON "purchase"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- =====================================================================
-- purchase_item — herda via purchase.store_id (JOIN). Padrão idêntico ao
-- cash_adjustment (que herda via cash_session.store_id).
-- =====================================================================
ALTER TABLE "purchase_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_item" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_item_tenant_isolation ON "purchase_item";
CREATE POLICY purchase_item_tenant_isolation ON "purchase_item"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "purchase" p
      WHERE p.id = purchase_item.purchase_id
        AND p.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "purchase" p
      WHERE p.id = purchase_item.purchase_id
        AND p.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  );

-- =====================================================================
-- receivable
-- =====================================================================
ALTER TABLE "receivable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receivable" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receivable_tenant_isolation ON "receivable";
CREATE POLICY receivable_tenant_isolation ON "receivable"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
