-- ADR-0024 — Atributos universais
-- RLS FORCE tenant_isolation nas 3 tabelas novas.
-- CHECK constraint: position >= 0 em attribute/attribute_value.

-- ------------ CHECK constraints ------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_position_nonneg') THEN
    ALTER TABLE attribute ADD CONSTRAINT attribute_position_nonneg CHECK (position >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_value_position_nonneg') THEN
    ALTER TABLE attribute_value ADD CONSTRAINT attribute_value_position_nonneg CHECK (position >= 0);
  END IF;
END $$;

-- ------------ RLS attribute ------------
ALTER TABLE "attribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attribute" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribute_tenant_isolation ON "attribute";
CREATE POLICY attribute_tenant_isolation ON "attribute"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- ------------ RLS attribute_value ------------
ALTER TABLE "attribute_value" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attribute_value" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribute_value_tenant_isolation ON "attribute_value";
CREATE POLICY attribute_value_tenant_isolation ON "attribute_value"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- ------------ RLS product_attribute_value ------------
ALTER TABLE "product_attribute_value" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_attribute_value" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_attribute_value_tenant_isolation ON "product_attribute_value";
CREATE POLICY product_attribute_value_tenant_isolation ON "product_attribute_value"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
