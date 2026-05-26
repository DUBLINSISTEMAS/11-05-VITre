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
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { brandTable } from "./brand";
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
    /**
     * S3.4 (2026-05-26) — opt-in pra rastreamento de lote+validade. UI
     * de compra exibe batch_number + expires_at obrigatórios pra produtos
     * desta categoria. Default false (joalheria, roupa não precisam).
     * Perfumaria/cosmético/medicamento marca true.
     */
    tracksBatch: boolean("tracks_batch").notNull().default(false),
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

/**
 * ADR-0034 Camada 1 — unidade de venda. Default `un` cobre 95% varejo SMB BR.
 * Adicionar valor novo se aparecer caso real (ex: `caixa`, `pacote`). Não
 * usar pra cálculo automático — Mangos Pay não converte unidades.
 */
// Onda 2.10 (2026-05-22): par/duzia adicionados via SQL 61 pra alinhar
// com glossário CLAUDE.md. `pc/cm/m3` permanecem no enum por compat com
// produtos legados — mas saíram do select da UI (tab-estoque.tsx).
export const productUnitEnum = pgEnum("product_unit", [
  "un",
  "pc",
  "kg",
  "g",
  "m",
  "cm",
  "ml",
  "L",
  "m2",
  "m3",
  "par",
  "duzia",
]);

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
// CHECKs ADR-0034 Camada 1 (cost_price >= 0, min_stock >= 0, max_stock >= 0,
// gtin length IN (8,12,13,14), ncm length = 8, commission_bps 0..10000) em
// supabase/sql/44_product_commercial_check_constraints.sql.
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
    /**
     * ADR-0034 Camada 2 — preço de atacado em centavos. NULL = produto não
     * tem preço de atacado configurado (default). Quando NOT NULL, o PDV
     * permite selecionar `price_table_used='wholesale'` e usa este valor.
     * CHECK: wholesale <= base (atacado nunca pode ser maior que varejo)
     * em supabase/sql/48_product_wholesale_check.sql.
     */
    wholesalePriceInCents: integer("wholesale_price_in_cents"),
    promoPriceInCents: integer("promo_price_in_cents"),
    promoStartsAt: timestamp("promo_starts_at"),
    promoEndsAt: timestamp("promo_ends_at"),
    trackStock: boolean("track_stock").notNull().default(true),
    stockQuantity: integer("stock_quantity"),
    /**
     * Onda 2.15 (2026-05-22) — permite venda mesmo com saldo zerado.
     * Casos de uso: produto sob encomenda, pré-venda, peça personalizada
     * em joalheria. Default false preserva o bloqueio (OUT_OF_STOCK).
     * Quando true, PDV emite aviso em vez de erro.
     * Aplicado em SQL 62.
     */
    allowOversell: boolean("allow_oversell").notNull().default(false),

    // =====================================================================
    // ADR-0034 Camada 1 — Dado-fonte de gestão.
    // Sem esses campos, margem é impossível e prospects chamam de amador.
    // Todos NULL-tolerant: lojista preenche aos poucos; UI mostra warning
    // mas não bloqueia operação.
    // =====================================================================
    /** Preço de custo unitário em centavos. NULL = ainda não preenchido. */
    costPriceInCents: integer("cost_price_in_cents"),
    /** Estoque mínimo — dispara alerta de reposição no relatório. */
    minStockQuantity: integer("min_stock_quantity"),
    /** Estoque máximo — projeção de compra (sem alerta visual no MVP). */
    maxStockQuantity: integer("max_stock_quantity"),
    /**
     * GTIN (EAN-8/12/13 ou DUN-14). Sem máscara, só dígitos. CHECK
     * length IN (8,12,13,14) no SQL 44. UNIQUE parcial (store, gtin)
     * WHERE gtin IS NOT NULL — duas peças com mesmo código no MESMO
     * tenant é erro de cadastro; tenants diferentes podem ter overlap.
     */
    gtin: text("gtin"),
    /**
     * Marca livre — texto. Sem tabela `brand` separada no MVP (varejo BR
     * usa nomes diretos: Adidas, Vivara, Lacoste).
     *
     * Sprint 2A: virou snapshot histórico. Quando lojista escolhe do select
     * de marcas cadastradas, salvamos brand_id + brand (nome no momento).
     * Rename ou delete da marca NÃO afeta produtos antigos (preserva relatórios
     * históricos).
     */
    brand: text("brand"),
    /**
     * Sprint 2A — FK opcional para tabela `brand`. NULL quando lojista digitou
     * texto livre em `brand` (sem escolher do select). ON DELETE SET NULL
     * mantém o snapshot em `brand` mesmo se a marca for deletada.
     * FK real declarada pra alinhar Drizzle ↔ Postgres (SQL 51) e habilitar
     * relations.brand em queries ORM.
     */
    brandId: uuid("brand_id").references(() => brandTable.id, {
      onDelete: "set null",
    }),
    /** Unidade de venda. Default 'un'. */
    unit: productUnitEnum("unit").notNull().default("un"),
    /**
     * Código interno do lojista (SKU manual, código de etiqueta).
     * UNIQUE parcial (store, internal_code) WHERE internal_code IS NOT NULL.
     */
    internalCode: text("internal_code"),
    /**
     * Comissão padrão de vendedor pra esse produto, em basis points
     * (0..10000 = 0..100%). NULL = usa fallback da store (a ser adicionado
     * em Camada 5 quando comissão virar feature exposta).
     */
    defaultCommissionBps: integer("default_commission_bps"),
    /**
     * NCM brasileiro (8 dígitos sem máscara) pra futura integração com
     * Bling/Tiny. **Mangos Pay NÃO valida nem calcula imposto a partir disso**
     * (ADR-0033 veto fiscal). Campo livre — lojista anota o que o
     * contador disser.
     */
    ncm: text("ncm"),
    /**
     * S2.7 (2026-05-26) — peso em gramas (precisão 3 casas decimais).
     * Joalheria de ouro/prata reprecifica por grama quando metal sobe.
     * Range 0..100000g via CHECK no SQL 74. Nullable — só joalheria preenche.
     * Drizzle pgcore não tem `decimal` tipado; usa `numeric()` que vira string.
     */
    weightGrams: numeric("weight_grams", { precision: 10, scale: 3 }),

    // Override do max-parcelas APENAS deste produto. null = usa
    // store.cardMaxInstallments. Range 1..12 (CHECK no SQL 17).
    // Caso de uso: lojista de joia tem default 3x global, mas no produto
    // "Aliança de ouro R$ 4.800" quer mostrar 10x. NÃO sobrescreve
    // acceptsCard nem showInstallmentsOnPDP — apenas o teto. Fase 2 / ADR-0013.
    installmentsOverride: integer("installments_override"),

    // Override do desconto à vista APENAS deste produto. null = usa
    // store.cashDiscountBps. Range 0..9999 bps (CHECK no SQL 18).
    // Caso de uso: loja default 5%, peça encalhada vira 20% à vista pra
    // limpar estoque. 0 também é override válido (= sem desconto neste
    // produto mesmo que loja ofereça). Memory team
    // `override-por-produto-heuristica-20-percent-2026-05-16`. Fase 2 / ADR-0013.
    cashDiscountOverrideBps: integer("cash_discount_override_bps"),

    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    /**
     * ADR-0030 (Frente B) — Separação Gestão × Loja Online.
     *
     * `isActive` = produto existe no sistema (PDV, estoque, relatórios).
     * `isPublishedToStorefront` = produto APARECE na vitrine pública.
     *
     * Default true pra compat. Backfill em SQL 36 garante produtos
     * existentes seguem visíveis. Storefront filtra
     * `isActive=true AND isPublishedToStorefront=true`.
     */
    isPublishedToStorefront: boolean("is_published_to_storefront")
      .notNull()
      .default(true),
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
  brand: one(brandTable, {
    fields: [productTable.brandId],
    references: [brandTable.id],
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
    /**
     * S2.6 (2026-05-26) — custo médio ponderado da variante (centavos).
     * NULL = herda de product.cost_price_in_cents. WAC variante-aware em
     * src/actions/purchase atualiza isso quando purchase_item.variant_id
     * é informado. CHECK >= 0 no SQL 77.
     */
    costPriceInCents: integer("cost_price_in_cents"),
    trackStock: boolean("track_stock").notNull().default(true),
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
