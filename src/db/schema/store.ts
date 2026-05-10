/**
 * Tabela `store` — o tenant. Cada lojista tem 1 ou mais lojas.
 * Slug é único globalmente. Demais entidades de domínio referenciam store por FK.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";

export const nicheEnum = pgEnum("niche", [
  "roupa_feminina",
  "joia",
  "semijoia",
  "perfumaria",
  "outro",
]);

export const storeTable = pgTable(
  "store",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      // ON DELETE RESTRICT: deletar usuário NÃO apaga a loja em silêncio.
      // Operação destrutiva precisa ser explícita (limpeza prévia ou cascade
      // manual). Ver supabase/sql/06_fk_safety.sql.
      .references(() => userTable.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    niche: nicheEnum("niche").notNull().default("outro"),

    // WhatsApp
    whatsappNumber: text("whatsapp_number").notNull(), // E.164: +5599981757512
    whatsappDisplay: text("whatsapp_display").notNull(), // (99) 98175-7512

    // Identidade visual
    logoUrl: text("logo_url"),
    iconUrl: text("icon_url"),
    primaryColor: text("primary_color").notNull().default("#1E3FE6"),
    // Variant da bottom-nav do storefront (canvas-v1).
    // Valores válidos: "pill" (default) | "rule" | "glass".
    // Tipo `text` em vez de pgEnum pra evitar migration de enum quando
    // adicionarmos novas variants. Aplicação valida em BottomNavVariant.
    bottomNavStyle: text("bottom_nav_style").notNull().default("pill"),

    // Endereço
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    googleMapsUrl: text("google_maps_url"),

    // Redes
    instagramHandle: text("instagram_handle"),

    // Estado
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("store_owner_idx").on(t.ownerId),
    ownerUnique: unique("store_owner_id_unique").on(t.ownerId),
  }),
);

// Relations declaradas em src/db/schema/relations.ts para evitar import cíclico.
export const storeUserRelations = relations(userTable, ({ many }) => ({
  stores: many(storeTable),
}));

export const storeRelations = relations(storeTable, ({ one }) => ({
  owner: one(userTable, {
    fields: [storeTable.ownerId],
    references: [userTable.id],
  }),
}));

export type Store = typeof storeTable.$inferSelect;
export type NewStore = typeof storeTable.$inferInsert;
