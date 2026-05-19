-- S4 da auditoria 2026-05-19 — hardening do INSERT anonimo em `lead`.
--
-- Estado anterior (SQL 34_lead_rls.sql):
--   CREATE POLICY lead_anon_insert ON "lead" FOR INSERT TO PUBLIC
--     WITH CHECK (true);
--
-- Risco: anonimo podia inserir lead com QUALQUER store_id (uuid arbitrario)
-- desde que satisfizesse a FK pra `store`. App-layer (recordLead) agora
-- resolve storeId via storeSlug server-side, mas a policy era frouxa demais.
--
-- Mudanca: WITH CHECK passa a exigir que `store_id` corresponda a uma loja
-- ATIVA. Spam continua possivel (anonimo nao tem como filtrar mais — o
-- store_id e descobrivel via slug publico), mas:
--   1) Lojas desativadas/excluidas nao recebem leads orfaos.
--   2) Defesa em profundidade caso app-layer regrida no futuro.
--   3) Performance ok: index PK em store.id + filtro is_active = b-tree.
--
-- Rate-limit por IP via Upstash continua sendo a barreira de spam principal
-- (60/min por bucket ip+store em `lead:${ip}:${storeId}`).

DROP POLICY IF EXISTS lead_anon_insert ON "lead";
CREATE POLICY lead_anon_insert ON "lead"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "store"
      WHERE "store".id = "lead".store_id
        AND "store".is_active = true
    )
  );
