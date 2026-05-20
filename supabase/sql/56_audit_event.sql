-- Sprint 6A — audit log de eventos críticos.
--
-- Tabela append-only que registra mudanças sensíveis no sistema. Casos
-- de uso v1:
--   - Forense pós-incidente ("quem estornou esse fiado?")
--   - Compliance (LGPD: trilha de quem manipulou dado de cliente)
--   - Detecção de comportamento anômalo (volume de deletes, estornos)
--
-- v1 só GRAVA. UI de listagem (/admin/auditoria) é Sprint 7+ quando
-- houver demanda concreta. Por ora, queries via SQL direto pra
-- investigação manual.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS "audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant — todo evento pertence a uma loja. RLS isola por aqui.
  "store_id" uuid NOT NULL REFERENCES "store"("id") ON DELETE CASCADE,

  -- Quem causou. NULL = sistema (cron, trigger, evento sem auth).
  -- Sem FK explícito pra user(id) porque user pode ser deletado e a
  -- gente quer preservar o histórico.
  "actor_user_id" text,

  -- Identificador do evento (namespaced). Convenção: "<domain>.<verb>".
  -- Ex: "receivable.payment_recorded", "order.return_recorded",
  -- "cash_session.opened", "product.deleted".
  "action" text NOT NULL,

  -- Tipo de entidade afetada. Ex: "receivable", "order", "product".
  "entity_type" text NOT NULL,

  -- ID da entidade afetada. NULL pra eventos sem alvo específico
  -- (ex: bulk delete antes do INSERT em massa).
  "entity_id" uuid,

  -- Snapshot relevante do evento (ex: { before: {...}, after: {...} }
  -- ou { amount_in_cents: 12345, method: "pix" }). JSONB pra permitir
  -- queries específicas se necessário.
  "payload" jsonb,

  -- IP do cliente (best-effort — pode vir mascarado por proxy).
  "ip" text,
  -- User-Agent (best-effort).
  "user_agent" text,

  "created_at" timestamp NOT NULL DEFAULT now()
);

-- =====================================================================
-- CHECK constraints
-- =====================================================================
ALTER TABLE "audit_event"
  DROP CONSTRAINT IF EXISTS audit_event_action_length;
ALTER TABLE "audit_event"
  ADD CONSTRAINT audit_event_action_length
  CHECK (char_length(action) >= 3 AND char_length(action) <= 80);

ALTER TABLE "audit_event"
  DROP CONSTRAINT IF EXISTS audit_event_entity_type_length;
ALTER TABLE "audit_event"
  ADD CONSTRAINT audit_event_entity_type_length
  CHECK (char_length(entity_type) >= 2 AND char_length(entity_type) <= 60);

ALTER TABLE "audit_event"
  DROP CONSTRAINT IF EXISTS audit_event_user_agent_length;
ALTER TABLE "audit_event"
  ADD CONSTRAINT audit_event_user_agent_length
  CHECK (user_agent IS NULL OR char_length(user_agent) <= 500);

ALTER TABLE "audit_event"
  DROP CONSTRAINT IF EXISTS audit_event_ip_length;
ALTER TABLE "audit_event"
  ADD CONSTRAINT audit_event_ip_length
  CHECK (ip IS NULL OR char_length(ip) <= 64);

-- =====================================================================
-- Indexes
-- =====================================================================
-- Hot path: listar últimos eventos de uma loja (ordem cronológica)
CREATE INDEX IF NOT EXISTS audit_event_store_created_idx
  ON "audit_event"("store_id", "created_at" DESC);

-- Lookup por entidade ("quem tocou no order X?")
CREATE INDEX IF NOT EXISTS audit_event_entity_idx
  ON "audit_event"("entity_type", "entity_id")
  WHERE entity_id IS NOT NULL;

-- Lookup por ator ("o que o user X fez ontem?")
CREATE INDEX IF NOT EXISTS audit_event_actor_idx
  ON "audit_event"("actor_user_id", "created_at" DESC)
  WHERE actor_user_id IS NOT NULL;

-- =====================================================================
-- RLS — tenant isolation pelo store_id (mesmo pattern dos outros).
-- =====================================================================
ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_event_tenant_isolation ON "audit_event";
CREATE POLICY audit_event_tenant_isolation ON "audit_event"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
