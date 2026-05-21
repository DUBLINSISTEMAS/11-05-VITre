-- Fase 2 / Bloco 2 — Hardening de `lead_anon_insert` (achado pela suite
-- tests/integration/rls-cross-tenant.test.ts em 2026-05-21).
--
-- Estado anterior (SQL 41_lead_anon_insert_hardening.sql):
--   CREATE POLICY lead_anon_insert ON "lead" FOR INSERT TO PUBLIC
--     WITH CHECK (
--       EXISTS (SELECT 1 FROM "store"
--               WHERE "store".id = "lead".store_id AND is_active = true)
--     );
--
-- Vulnerabilidade descoberta:
--   Postgres combina policies PERMISSIVE com OR. `lead` tem duas policies
--   pra INSERT:
--     - `lead_tenant_isolation`  (FOR ALL, store_id = current_store_id)
--     - `lead_anon_insert`       (FOR INSERT TO PUBLIC, store ativa existe)
--   Sessão autenticada `vitre_app` com store própria (lojista A) podia
--   inserir lead com `store_id` da loja B — `lead_tenant_isolation` rejeita,
--   mas `lead_anon_insert` aceita (loja B está ativa). OR → INSERT permitido.
--   Spam cross-tenant de leads viável a partir de qualquer sessão logada.
--
-- Em produção `recordLead` (src/actions/lead/record.ts) usa `withServiceRole`
-- (BYPASSRLS), então a policy não fira pra esse path legítimo — o buraco era
-- pra clientes que executassem SQL bruto sob `vitre_app` (ex: bug futuro em
-- action que esquecesse `withServiceRole`).
--
-- Fix:
--   Exige `current_user_id = 'anonymous'` (constante ANON_USER_ID em
--   src/lib/tenant.ts) pra policy fire. Sessão autenticada cai SOMENTE
--   em `lead_tenant_isolation` → store_id próprio obrigatório.
--
-- Compatibilidade:
--   - `recordLead` continua intacto (service role bypassa toda RLS).
--   - Storefront se ALGUM dia migrar pra vitre_app + anon GUC, basta setar
--     `app.current_user_id = 'anonymous'` (já é o default de withTenant
--     quando userId = null) e a policy permite.
--
-- Idempotente: DROP + CREATE.

DROP POLICY IF EXISTS lead_anon_insert ON "lead";
CREATE POLICY lead_anon_insert ON "lead"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    NULLIF(current_setting('app.current_user_id', true), '') = 'anonymous'
    AND EXISTS (
      SELECT 1 FROM "store"
      WHERE "store".id = "lead".store_id
        AND "store".is_active = true
    )
  );
