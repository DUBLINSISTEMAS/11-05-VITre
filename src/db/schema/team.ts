/**
 * Equipe multi-user (ADR-0029, Fase 1).
 *
 * `store_membership` registra usuários adicionais que têm acesso à loja
 * além do owner. Owner permanece em `store.owner_id` — source-of-truth.
 *
 * Status:
 *   - "pending":  convite enviado, ainda não aceito
 *   - "active":   user aceitou e tem acesso
 *   - "revoked":  acesso desativado (mas histórico preservado)
 *
 * Roles:
 *   - "owner":  duplica store.owner_id em casos especiais (transfer, multi-store futuro)
 *   - "staff":  tudo exceto config crítica
 *   - "viewer": read-only
 */
import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";
import { storeTable } from "./store";

export const teamRoleEnum = pgEnum("team_role", ["owner", "staff", "viewer"]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "active",
  "revoked",
]);

export const storeMembershipTable = pgTable(
  "store_membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    /** Pode ser NULL enquanto o convite está pendente (user nem criou conta ainda). */
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
    /** Email do convite — usado pra match quando user faz signup com este email. */
    invitedEmail: text("invited_email").notNull(),
    role: teamRoleEnum("role").notNull().default("staff"),
    status: membershipStatusEnum("status").notNull().default("pending"),
    /** Quem convidou. NULL = self-add (owner). */
    invitedByUserId: text("invited_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("store_membership_store_idx").on(t.storeId),
    userIdx: index("store_membership_user_idx").on(t.userId),
    storeEmailUnique: unique("store_membership_store_email_unique").on(
      t.storeId,
      t.invitedEmail,
    ),
  }),
);

export const storeMembershipRelations = relations(
  storeMembershipTable,
  ({ one }) => ({
    store: one(storeTable, {
      fields: [storeMembershipTable.storeId],
      references: [storeTable.id],
    }),
    user: one(userTable, {
      fields: [storeMembershipTable.userId],
      references: [userTable.id],
    }),
  }),
);

export type StoreMembership = typeof storeMembershipTable.$inferSelect;
export type NewStoreMembership = typeof storeMembershipTable.$inferInsert;
export type TeamRole = (typeof teamRoleEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
