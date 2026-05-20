/**
 * Marca (brand) — Sprint 2 ativará CRUD em /admin/marcas (substitui texto
 * livre no form de produto). Preparada no Sprint 0/Prompt 6 só para
 * desbloquear o schema Drizzle. Migration SQL em supabase/sql/49_create_brand_table.sql
 * (idempotente, NÃO aplicada ainda).
 *
 * Decisões iniciais:
 * - RLS-first, store_id obrigatório.
 * - slug per-store unique.
 * - CHECK: name/slug não vazios (no SQL, redundante no app-layer).
 * - sem soft delete; cascata via store.
 */
import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { storeTable } from "./store";

export const brandTable = pgTable(
  "brand",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** Slug derivado do name. Unique por store (per índice). */
    slug: text("slug").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("brand_store_idx").on(t.storeId),
    storeSlugUnique: unique("brand_store_slug_unique").on(t.storeId, t.slug),
  }),
);

export const brandRelations = relations(brandTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [brandTable.storeId],
    references: [storeTable.id],
  }),
}));

export type Brand = typeof brandTable.$inferSelect;
export type NewBrand = typeof brandTable.$inferInsert;
