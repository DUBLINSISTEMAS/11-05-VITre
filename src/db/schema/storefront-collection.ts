/**
 * Coleções customizáveis da loja online (ADR-0031, Frente C).
 *
 * Lojista cria "rotas" nomeadas com produtos curados — ex: "Destaques",
 * "Promoções de maio", "Lançamentos". Cada coleção:
 *   - tem um slug único por loja → /colecao/[slug]
 *   - pode aparecer como seção na home (show_in_home)
 *   - lista produtos via tabela join `storefront_collection_item` com
 *     posição manual (drag-drop futuramente)
 *
 * RLS em supabase/sql/36_storefront_collection_rls.sql.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { productTable } from "./catalog";
import { storeTable } from "./store";

export const storefrontCollectionTable = pgTable(
  "storefront_collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** URL slug (`/colecao/[slug]`). UNIQUE por loja. */
    slug: text("slug").notNull(),
    description: text("description"),
    /** Ordem entre coleções (na home / lista admin). */
    position: integer("position").notNull().default(0),
    /** Se a coleção aparece como seção na home da loja. */
    showInHome: boolean("show_in_home").notNull().default(true),
    /** Coleção desativada = oculta de tudo (sem deletar produtos). */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeSlugUnique: unique("storefront_collection_store_slug_unique").on(
      t.storeId,
      t.slug,
    ),
    storeIdx: index("storefront_collection_store_idx").on(t.storeId),
  }),
);

export const storefrontCollectionItemTable = pgTable(
  "storefront_collection_item",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => storefrontCollectionTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    /**
     * `store_id` denormalizado: RLS opera por `current_setting('app.current_store_id')`
     * sem JOIN. Trigger valida que matches com collection.store_id.
     */
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.productId] }),
    storeIdx: index("storefront_collection_item_store_idx").on(t.storeId),
    collectionIdx: index("storefront_collection_item_collection_idx").on(
      t.collectionId,
    ),
    productIdx: index("storefront_collection_item_product_idx").on(t.productId),
  }),
);

export const storefrontCollectionRelations = relations(
  storefrontCollectionTable,
  ({ one, many }) => ({
    store: one(storeTable, {
      fields: [storefrontCollectionTable.storeId],
      references: [storeTable.id],
    }),
    items: many(storefrontCollectionItemTable),
  }),
);

export const storefrontCollectionItemRelations = relations(
  storefrontCollectionItemTable,
  ({ one }) => ({
    collection: one(storefrontCollectionTable, {
      fields: [storefrontCollectionItemTable.collectionId],
      references: [storefrontCollectionTable.id],
    }),
    product: one(productTable, {
      fields: [storefrontCollectionItemTable.productId],
      references: [productTable.id],
    }),
  }),
);

export type StorefrontCollection = typeof storefrontCollectionTable.$inferSelect;
export type NewStorefrontCollection =
  typeof storefrontCollectionTable.$inferInsert;
export type StorefrontCollectionItem =
  typeof storefrontCollectionItemTable.$inferSelect;
