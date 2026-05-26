/**
 * parked_sale — carrinho pausado no PDV (S3.3 do Plano de Endurecimento).
 *
 * Vendedora atende outro cliente sem perder estado do anterior.
 * Items em jsonb (snapshot livre — retomada recalcula preço).
 * Auto-expira 4h.
 */
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";
import { customerTable } from "./customer";
import { storeTable } from "./store";

export interface ParkedItem {
  productId: string;
  variantId: string | null;
  quantity: number;
  /** Snapshot pra UI listar sem refetch. */
  productName?: string;
  variantName?: string | null;
  unitPriceInCents?: number;
  discountInCents?: number;
}

export const parkedSaleTable = pgTable(
  "parked_sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "set null",
    }),
    label: text("label"),
    items: jsonb("items")
      .$type<ParkedItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    parkedAt: timestamp("parked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + INTERVAL '4 hours'`),
  },
  (t) => ({
    userStoreIdx: index("parked_sale_user_store_idx").on(
      t.storeId,
      t.userId,
      t.parkedAt,
    ),
    expiresIdx: index("parked_sale_expires_idx").on(t.expiresAt),
  }),
);

export type ParkedSale = typeof parkedSaleTable.$inferSelect;
export type NewParkedSale = typeof parkedSaleTable.$inferInsert;
