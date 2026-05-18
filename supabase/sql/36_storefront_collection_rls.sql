-- ADR-0031 — Storefront collections (Frente C)
-- RLS tenant_isolation em ambas as tabelas.
-- Storefront público lê via service-role (loaders no app-layer).

ALTER TABLE "storefront_collection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_collection" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_collection_tenant_isolation ON "storefront_collection";
CREATE POLICY storefront_collection_tenant_isolation ON "storefront_collection"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

ALTER TABLE "storefront_collection_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_collection_item" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_collection_item_tenant_isolation ON "storefront_collection_item";
CREATE POLICY storefront_collection_item_tenant_isolation ON "storefront_collection_item"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- CHECK position >= 0 em ambas (uniforme com outras tabelas)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_collection_position_nonneg') THEN
    ALTER TABLE storefront_collection ADD CONSTRAINT storefront_collection_position_nonneg CHECK (position >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_collection_item_position_nonneg') THEN
    ALTER TABLE storefront_collection_item ADD CONSTRAINT storefront_collection_item_position_nonneg CHECK (position >= 0);
  END IF;
  -- slug: lowercase + alphanumerico + hyphens, 1..60 chars
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_collection_slug_format') THEN
    ALTER TABLE storefront_collection ADD CONSTRAINT storefront_collection_slug_format
      CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 60);
  END IF;
END $$;
