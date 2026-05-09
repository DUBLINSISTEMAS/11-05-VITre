/**
 * Pedidos e itens. orderItem snapshota produto/variante para sobreviver a deletes.
 * Estados: awaiting_whatsapp -> confirmed -> fulfilled | canceled | expired
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { storeTable } from "./store";

export const orderStatusEnum = pgEnum("order_status", [
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
  "canceled",
  "expired",
]);

// =====================================================================
// Order
// =====================================================================
// Index composto (store_id, created_at DESC) para o listing /admin/pedidos
// vive em supabase/sql/05_indexes_for_scale.sql (substitui o antigo
// `order_created_idx` que indexava só created_at).
//
// CHECK total_in_cents >= 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const orderTable = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortCode: text("short_code").notNull().unique(), // "A7K2"
    publicToken: text("public_token").notNull().unique(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /**
     * Idempotency key gerada pelo client (crypto.randomUUID()) no mount
     * do checkout. Server faz INSERT ON CONFLICT (storeId, idempotencyKey)
     * DO NOTHING — duplo-clique não cria pedidos duplicados.
     * Aplicada via supabase/sql/03_order_idempotency.sql.
     */
    idempotencyKey: text("idempotency_key").notNull(),

    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(), // E.164
    customerNotes: text("customer_notes"),

    totalInCents: integer("total_in_cents").notNull(),

    status: orderStatusEnum("status").notNull().default("awaiting_whatsapp"),

    whatsappOpenedAt: timestamp("whatsapp_opened_at"),
    confirmedAt: timestamp("confirmed_at"),
    expiresAt: timestamp("expires_at").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("order_store_idx").on(t.storeId),
    statusIdx: index("order_status_idx").on(t.storeId, t.status),
    // `order_created_idx` (apenas created_at) foi removido em 05 — o composto
    // `order_store_created_idx` vive em SQL (não declarado aqui pra não
    // duplicar). Listing real sempre filtra por store_id, então a versão
    // composta é estritamente melhor.
    storeIdempotencyUnique: unique("order_store_idempotency_unique").on(
      t.storeId,
      t.idempotencyKey,
    ),
  }),
);

export const orderRelations = relations(orderTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [orderTable.storeId],
    references: [storeTable.id],
  }),
  items: many(orderItemTable),
}));

export type Order = typeof orderTable.$inferSelect;
export type NewOrder = typeof orderTable.$inferInsert;

// =====================================================================
// Order Item
// =====================================================================
// CHECK quantity > 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const orderItemTable = pgTable(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orderTable.id, { onDelete: "cascade" }),

    // SNAPSHOT — não-FK para sobreviver a deletes
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),
    imageUrlSnapshot: text("image_url_snapshot"),
    priceInCentsSnapshot: integer("price_in_cents_snapshot").notNull(),

    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("order_item_order_idx").on(t.orderId),
  }),
);

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderItemTable.orderId],
    references: [orderTable.id],
  }),
}));

export type OrderItem = typeof orderItemTable.$inferSelect;
export type NewOrderItem = typeof orderItemTable.$inferInsert;
