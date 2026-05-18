-- ADR-0029 — Equipe multi-user (Fase 1: schema + RLS)
-- Tenant isolation por store_id. Status transitions validados na app layer.

ALTER TABLE "store_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_membership" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_membership_tenant_isolation ON "store_membership";
CREATE POLICY store_membership_tenant_isolation ON "store_membership"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
