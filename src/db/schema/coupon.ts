/**
 * Cupons (ADR-0026).
 *
 * Catálogo de códigos por loja, validade temporal, limite de usos.
 * Aplicação no PDV: server action valida + aplica como discount no order.
 * Storefront NÃO aplica automaticamente (lojista combina via WhatsApp).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
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

/**
 * Como o desconto é calculado:
 *   - "percentage": discountValue é basis points (1000 = 10%)
 *   - "fixed":      discountValue é centavos (1000 = R$ 10)
 */
export const couponDiscountTypeEnum = pgEnum("coupon_discount_type", [
  "percentage",
  "fixed",
]);

export const couponTable = pgTable(
  "coupon",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /** Código (uppercase). UNIQUE por loja. Ex: "BLACKFRIDAY", "PRIMEIRA20". */
    code: text("code").notNull(),

    discountType: couponDiscountTypeEnum("discount_type").notNull(),
    /** percentage: 0..9999 bps · fixed: cents >= 0. CHECK no SQL 33. */
    discountValue: integer("discount_value").notNull(),

    /** NULL = vale desde sempre. */
    startsAt: timestamp("starts_at"),
    /** NULL = sem expiração. */
    endsAt: timestamp("ends_at"),

    /** NULL = ilimitado. */
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),

    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("coupon_store_idx").on(t.storeId),
    storeCodeUnique: unique("coupon_store_code_unique").on(t.storeId, t.code),
    activeIdx: index("coupon_active_idx").on(t.storeId, t.isActive),
  }),
);

export const couponRelations = relations(couponTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [couponTable.storeId],
    references: [storeTable.id],
  }),
}));

export type Coupon = typeof couponTable.$inferSelect;
export type NewCoupon = typeof couponTable.$inferInsert;
export type CouponDiscountType =
  (typeof couponDiscountTypeEnum.enumValues)[number];
