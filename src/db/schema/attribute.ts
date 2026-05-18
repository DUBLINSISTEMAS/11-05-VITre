/**
 * Atributos universais (ADR-0024).
 *
 * `attribute` = categoria reutilizável (Cor, Tamanho, Material).
 * `attribute_value` = valor concreto dentro do atributo (Vermelho #C71F1F, P, 100% algodão).
 * `product_attribute_value` = junction many-to-many com produto.
 *
 * NÃO substitui `product_variant.attributes jsonb` — coexiste. Refatoração
 * de variantes pra FK fica como Fase 2 quando filtros do storefront pedirem.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { productTable } from "./catalog";
import { storeTable } from "./store";

/**
 * Tipo do atributo. Define como a UI renderiza:
 *   - "color": value tem `colorHex`, vira swatch
 *   - "size":  label simples ("P", "M", "100ml")
 *   - "text":  catch-all (material, gênero, faixa etária)
 */
export const attributeTypeEnum = pgEnum("attribute_type", [
  "color",
  "size",
  "text",
]);

export const attributeTable = pgTable(
  "attribute",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Cor", "Tamanho", "Material"
    type: attributeTypeEnum("type").notNull().default("text"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("attribute_store_idx").on(t.storeId),
    storeNameUnique: unique("attribute_store_name_unique").on(t.storeId, t.name),
  }),
);

export const attributeValueTable = pgTable(
  "attribute_value",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => attributeTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Vermelho", "P", "100% algodão"
    // Só preenchido quando attribute.type = "color". CSS color string
    // (hex/oklch/rgb). UI valida formato — DB aceita qualquer texto.
    colorHex: text("color_hex"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    attributeIdx: index("attribute_value_attribute_idx").on(t.attributeId),
    storeIdx: index("attribute_value_store_idx").on(t.storeId),
    attributeLabelUnique: unique("attribute_value_attribute_label_unique").on(
      t.attributeId,
      t.label,
    ),
  }),
);

/**
 * Junction product ↔ attribute_value (many-to-many).
 *
 * Cada par é único (PK composto). ON DELETE CASCADE em ambos lados —
 * se produto ou valor sumir, o vínculo evapora.
 */
export const productAttributeValueTable = pgTable(
  "product_attribute_value",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    attributeValueId: uuid("attribute_value_id")
      .notNull()
      .references(() => attributeValueTable.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.attributeValueId] }),
    productIdx: index("product_attribute_value_product_idx").on(t.productId),
    valueIdx: index("product_attribute_value_value_idx").on(t.attributeValueId),
    storeIdx: index("product_attribute_value_store_idx").on(t.storeId),
  }),
);

export const attributeRelations = relations(attributeTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [attributeTable.storeId],
    references: [storeTable.id],
  }),
  values: many(attributeValueTable),
}));

export const attributeValueRelations = relations(
  attributeValueTable,
  ({ one, many }) => ({
    attribute: one(attributeTable, {
      fields: [attributeValueTable.attributeId],
      references: [attributeTable.id],
    }),
    productLinks: many(productAttributeValueTable),
  }),
);

export const productAttributeValueRelations = relations(
  productAttributeValueTable,
  ({ one }) => ({
    product: one(productTable, {
      fields: [productAttributeValueTable.productId],
      references: [productTable.id],
    }),
    value: one(attributeValueTable, {
      fields: [productAttributeValueTable.attributeValueId],
      references: [attributeValueTable.id],
    }),
  }),
);

export type Attribute = typeof attributeTable.$inferSelect;
export type NewAttribute = typeof attributeTable.$inferInsert;
export type AttributeValue = typeof attributeValueTable.$inferSelect;
export type NewAttributeValue = typeof attributeValueTable.$inferInsert;
export type ProductAttributeValue = typeof productAttributeValueTable.$inferSelect;
