/**
 * Catálogo: category, product, productImage, productVariant, banner.
 * Toda tabela carrega `store_id` para isolamento via RLS.
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { storeTable } from "./store";

// =====================================================================
// Category
// Hierarquia: 2 níveis máximo (raiz + filha). parent_id NULL = categoria raiz.
// Validação no app impede aninhamento profundo. Ver ADR-0008.
//
// CHECK position >= 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const categoryTable = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    // ON DELETE RESTRICT: deletar categoria-pai NÃO apaga as filhas em
    // silêncio. App resolve filhos antes (mover/deletar). Ver
    // supabase/sql/06_fk_safety.sql.
    parentId: uuid("parent_id").references((): AnyPgColumn => categoryTable.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    imageUrl: text("image_url"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeSlugUnique: unique("category_store_slug_unique").on(t.storeId, t.slug),
    storeIdx: index("category_store_idx").on(t.storeId),
    parentIdx: index("category_parent_idx").on(t.parentId),
  }),
);

export const categoryRelations = relations(categoryTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [categoryTable.storeId],
    references: [storeTable.id],
  }),
  parent: one(categoryTable, {
    fields: [categoryTable.parentId],
    references: [categoryTable.id],
    relationName: "category_parent",
  }),
  children: many(categoryTable, { relationName: "category_parent" }),
  products: many(productTable),
}));

export type Category = typeof categoryTable.$inferSelect;
export type NewCategory = typeof categoryTable.$inferInsert;

// =====================================================================
// Product
// =====================================================================
// Indexes parciais (WHERE is_active = true) e GIN trigram em LOWER(name)
// vivem em supabase/sql/05_indexes_for_scale.sql — drizzle-kit não captura
// expressões nem WHERE-clauses de forma estável, então mantemos só os
// índices simples aqui pra evitar drift.
//
// CHECK constraints (base_price >= 0, promo_price >= 0|NULL, stock_quantity
// >= 0|NULL) vivem em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const productTable = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categoryTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    basePriceInCents: integer("base_price_in_cents").notNull(),
    promoPriceInCents: integer("promo_price_in_cents"),
    promoStartsAt: timestamp("promo_starts_at"),
    promoEndsAt: timestamp("promo_ends_at"),
    trackStock: boolean("track_stock").notNull().default(false),
    stockQuantity: integer("stock_quantity"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    // Meta fields canvas-v1 (PDP linhas 326-338) — todos opcionais.
    // Renderizados em meta-grid 2-col só quando algum deles tem valor.
    composition: text("composition"), // ex: "100% linho"
    modeling: text("modeling"),       // ex: "Evasê midi"
    lining: text("lining"),           // ex: "Não possui"
    washing: text("washing"),         // ex: "À mão"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeSlugUnique: unique("product_store_slug_unique").on(t.storeId, t.slug),
    storeIdx: index("product_store_idx").on(t.storeId),
    categoryIdx: index("product_category_idx").on(t.categoryId),
    activeIdx: index("product_active_idx").on(t.storeId, t.isActive),
  }),
);

export const productRelations = relations(productTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [productTable.storeId],
    references: [storeTable.id],
  }),
  category: one(categoryTable, {
    fields: [productTable.categoryId],
    references: [categoryTable.id],
  }),
  images: many(productImageTable),
  variants: many(productVariantTable),
}));

export type Product = typeof productTable.$inferSelect;
export type NewProduct = typeof productTable.$inferInsert;

// =====================================================================
// Product Image
// =====================================================================
// CHECK position >= 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const productImageTable = pgTable(
  "product_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    alt: text("alt"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index("product_image_product_idx").on(t.productId),
    storeIdx: index("product_image_store_idx").on(t.storeId),
    productPositionUnique: unique("product_image_product_position_unique").on(
      t.productId,
      t.position,
    ),
  }),
);

export const productImageRelations = relations(productImageTable, ({ one }) => ({
  product: one(productTable, {
    fields: [productImageTable.productId],
    references: [productTable.id],
  }),
}));

export type ProductImage = typeof productImageTable.$inferSelect;
export type NewProductImage = typeof productImageTable.$inferInsert;

// =====================================================================
// Product Variant
// =====================================================================
// CHECKs em price_in_cents (>= 0|NULL) e stock_quantity (>= 0|NULL) em
// supabase/sql/07_check_constraints.sql.
//
// Eixo (`axis`) define como a variante é exibida no PDP canvas-v1:
//   - "size":  pill 46×38 rounded-8 com texto (ex: "P", "M", "100ml")
//   - "color": swatch 34×34 rounded-full preenchido por `colorHex`
// Default "size" preserva comportamento histórico (todas variantes
// existentes são tamanho).
// =====================================================================
export const variantAxisEnum = pgEnum("variant_axis", ["size", "color"]);

export const productVariantTable = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "P", "M", "G", "Anel 12", "100ml", "Cru"
    sku: text("sku"),
    attributes: jsonb("attributes")
      .notNull()
      .default(sql`'{}'::jsonb`), // { tamanho: "P", cor: "preto" }
    priceInCents: integer("price_in_cents"), // null = usa product.basePriceInCents
    promoPriceInCents: integer("promo_price_in_cents"),
    trackStock: boolean("track_stock").notNull().default(false),
    stockQuantity: integer("stock_quantity"),
    isActive: boolean("is_active").notNull().default(true),
    // Eixo canvas-v1 — define renderização no PDP (pill vs swatch).
    axis: variantAxisEnum("axis").notNull().default("size"),
    // CSS color (hex/oklch/rgb) — só usado quando axis="color".
    // Ex: "oklch(0.85 0.02 80)", "#1E3FE6", "rgb(231,200,170)".
    colorHex: text("color_hex"),
    // Foto destacada por variante (padrão Shopify): quando cliente
    // seleciona essa variação no PDP, a galeria principal scrolla pra
    // essa imagem. NULL = usa primeira imagem do produto (padrão).
    // ON DELETE SET NULL: se a foto for removida, variante volta a
    // mostrar a foto padrão sem quebrar.
    featuredImageId: uuid("featured_image_id").references(
      () => productImageTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index("variant_product_idx").on(t.productId),
    storeIdx: index("variant_store_idx").on(t.storeId),
    featuredImageIdx: index("variant_featured_image_idx").on(t.featuredImageId),
  }),
);

export const productVariantRelations = relations(productVariantTable, ({ one }) => ({
  product: one(productTable, {
    fields: [productVariantTable.productId],
    references: [productTable.id],
  }),
}));

export type ProductVariant = typeof productVariantTable.$inferSelect;
export type NewProductVariant = typeof productVariantTable.$inferInsert;

// =====================================================================
// Banner
// =====================================================================
// CHECK position >= 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const bannerTable = pgTable(
  "banner",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    link: text("link"),
    // Campos editoriais (canvas-v1) — todos opcionais.
    // HeroCard renderiza com fallback quando ausentes.
    kicker: text("kicker"), // ex: "NOVA COLEÇÃO · OUTONO 26"
    title: text("title"), // ex: "Linhas que respiram."
    subtitle: text("subtitle"), // ex: "14 peças em algodão e linho."
    ctaLabel: text("cta_label"), // ex: "Ver coleção"
    imageAlt: text("image_alt"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("banner_store_idx").on(t.storeId),
  }),
);

export const bannerRelations = relations(bannerTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [bannerTable.storeId],
    references: [storeTable.id],
  }),
}));

export type Banner = typeof bannerTable.$inferSelect;
export type NewBanner = typeof bannerTable.$inferInsert;

// =====================================================================
// ProductRelated
// Curadoria manual de "Você pode gostar também" — Onda 4 (2026-05-13).
// Quando vazia pro produto, loader cai pro auto-pick (mesma categoria
// → mais recentes da loja). Quando preenchida, manual ganha 100%.
//
// PK composta (productId, relatedProductId) garante par único.
// storeId redundante mas necessário pra RLS via withTenant.
// =====================================================================
export const productRelatedTable = pgTable(
  "product_related",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    relatedProductId: uuid("related_product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.relatedProductId] }),
    storeIdx: index("product_related_store_idx").on(t.storeId),
    productIdx: index("product_related_product_idx").on(t.productId, t.position),
  }),
);

export const productRelatedRelations = relations(
  productRelatedTable,
  ({ one }) => ({
    store: one(storeTable, {
      fields: [productRelatedTable.storeId],
      references: [storeTable.id],
    }),
    product: one(productTable, {
      fields: [productRelatedTable.productId],
      references: [productTable.id],
      relationName: "product_related_owner",
    }),
    related: one(productTable, {
      fields: [productRelatedTable.relatedProductId],
      references: [productTable.id],
      relationName: "product_related_target",
    }),
  }),
);

export type ProductRelated = typeof productRelatedTable.$inferSelect;
export type NewProductRelated = typeof productRelatedTable.$inferInsert;
