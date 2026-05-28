import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { productTable } from "./catalog";
import { storeTable } from "./store";

export const productCostComponentTable = pgTable(
  "product_cost_component",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => storeTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => productTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountInCents: integer("amount_in_cents").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("product_cost_component_store_idx").on(t.storeId),
    productIdx: index("product_cost_component_product_idx").on(t.productId),
  }),
);
