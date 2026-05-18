-- ADR-0027 — Lead RLS.
-- INSERT anônimo permitido pelo storefront (botão WhatsApp).
-- SELECT/UPDATE/DELETE restritos ao tenant via app.current_store_id.

ALTER TABLE "lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead" FORCE ROW LEVEL SECURITY;

-- Tenant isolation (SELECT/UPDATE/DELETE/ALL) — só com store_id no GUC
DROP POLICY IF EXISTS lead_tenant_isolation ON "lead";
CREATE POLICY lead_tenant_isolation ON "lead"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- Storefront público (anon) INSERT — sem GUC. Recordar lead não requer
-- sessão. WITH CHECK true permite, mas o service role é quem ataca esse
-- path via recordLead action (server-side, dentro de withServiceRole).
-- A action valida o produto antes de gravar (defesa em camadas).
DROP POLICY IF EXISTS lead_anon_insert ON "lead";
CREATE POLICY lead_anon_insert ON "lead"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);
