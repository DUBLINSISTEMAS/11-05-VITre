/**
 * Lead — intenção de compra registrada quando cliente clica no botão
 * "Comprar via WhatsApp" no storefront (ADR-0027).
 *
 * Diferente de `order`: lead NÃO é venda confirmada. Lojista vai pro WA,
 * conversa, e se fechar, cria order normalmente. Lead vira "converted"
 * apenas quando lojista marca manualmente (ou via heurística de matching
 * por phone — fora do MVP).
 */
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { productTable } from "./catalog";
import { customerTable } from "./customer";
import { storeTable } from "./store";

export const leadSourceEnum = pgEnum("lead_source", [
  "pdp_button", // botão WA do PDP
  "list_button", // botão WA inline na listagem
  "cart_button", // botão WA da sacola/checkout
  // Sprint 5.2 (SQL 67) — formulário público /[storeSlug]/contato.
  // Diferente dos outros: cliente preenche nome + telefone + mensagem,
  // não intenção de compra de produto específico.
  "contact_form",
  "other",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new", // nunca contatado
  "contacted", // lojista mandou msg/respondeu
  "converted", // virou venda
  "lost", // perdeu (sem resposta, desistiu)
]);

export type ProductSnapshot = {
  name: string;
  priceInCents: number;
  url: string | null;
};

export const leadTable = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    productId: uuid("product_id").references(() => productTable.id, {
      onDelete: "set null",
    }),

    customerName: text("customer_name"),
    customerPhone: text("customer_phone"), // E.164 quando houver

    /** Snapshot imutável (sobrevive se produto for renomeado/excluído). */
    productSnapshot: jsonb("product_snapshot").$type<ProductSnapshot | null>(),

    source: leadSourceEnum("source").notNull().default("pdp_button"),
    status: leadStatusEnum("status").notNull().default("new"),

    /** Cliente vinculado depois do follow-up. */
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "set null",
    }),

    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("lead_store_idx").on(t.storeId),
    storeCreatedIdx: index("lead_store_created_idx").on(t.storeId, t.createdAt),
    storeStatusIdx: index("lead_store_status_idx").on(t.storeId, t.status),
    productIdx: index("lead_product_idx").on(t.productId),
    customerIdx: index("lead_customer_idx").on(t.customerId),
  }),
);

export const leadRelations = relations(leadTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [leadTable.storeId],
    references: [storeTable.id],
  }),
  product: one(productTable, {
    fields: [leadTable.productId],
    references: [productTable.id],
  }),
  customer: one(customerTable, {
    fields: [leadTable.customerId],
    references: [customerTable.id],
  }),
}));

export type Lead = typeof leadTable.$inferSelect;
export type NewLead = typeof leadTable.$inferInsert;
export type LeadSource = (typeof leadSourceEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
