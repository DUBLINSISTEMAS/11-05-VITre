/**
 * Sprint 6A — audit_event.
 *
 * Append-only log de eventos críticos do sistema. Forense pós-incidente,
 * compliance (LGPD), detecção de comportamento anômalo.
 *
 * v1 só grava — UI de listagem é Sprint futura. Queries via SQL direto
 * pra investigação manual.
 *
 * Schema espelha supabase/sql/56_audit_event.sql. RLS FORCE com
 * tenant_isolation pelo store_id.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { storeTable } from "./store";

export const auditEventTable = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    /**
     * Quem causou. NULL = sistema (cron, trigger). Sem FK pra user(id)
     * porque user pode ser deletado e a gente quer preservar o histórico.
     */
    actorUserId: text("actor_user_id"),
    /**
     * Identificador namespaced. Convenção: `<domain>.<verb>`.
     * Ex: `receivable.payment_recorded`, `order.return_recorded`.
     */
    action: text("action").notNull(),
    /** Tipo de entidade afetada. Ex: `receivable`, `order`, `product`. */
    entityType: text("entity_type").notNull(),
    /** ID da entidade afetada. NULL pra eventos sem alvo específico. */
    entityId: uuid("entity_id"),
    /**
     * Snapshot do evento. Ex: `{ before: {...}, after: {...} }` ou
     * `{ amount_in_cents: 12345 }`. JSONB pra queries específicas.
     */
    payload: jsonb("payload"),
    /** IP do cliente (best-effort — pode vir mascarado por proxy). */
    ip: text("ip"),
    /** User-Agent (best-effort). */
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeCreatedIdx: index("audit_event_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
    entityIdx: index("audit_event_entity_idx").on(t.entityType, t.entityId),
    actorIdx: index("audit_event_actor_idx").on(t.actorUserId, t.createdAt),
  }),
);

export type AuditEvent = typeof auditEventTable.$inferSelect;
export type NewAuditEvent = typeof auditEventTable.$inferInsert;
