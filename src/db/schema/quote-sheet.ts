/**
 * Ficha de orçamento de balcão (2026-05-28) — versão SaaS do talão de papel
 * usado por joalheria/serviço no ICP.
 *
 * Diferente do orçamento itemizado vindo do PDV (`order.status='quote'`),
 * esta ficha é TEXTO LIVRE: joalheiro descreve a peça em "discriminação",
 * coloca valor total, entrada (com forma livre — "Pix R$ 500", "12× cartão")
 * e o restante é auto-calculado. Sem ligação com catálogo, sem desconto
 * de estoque, sem cliente vinculado obrigatório.
 *
 * O imprimível sai em A4 com assinaturas cliente/responsável + aviso
 * configurável ("Não nos responsabilizamos por peças deixadas há mais de
 * 90 dias…").
 *
 * COEXISTE com `order.status='quote'` em `/admin/orcamentos`. Não é
 * substituição — atendem perfis diferentes (joia/serviço vs roupa/perfumaria).
 *
 * RLS tenant_isolation + CHECKs inline na migration drizzle 0038.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";
import { storeTable } from "./store";

export const quoteSheetTable = pgTable(
  "quote_sheet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    /** Código curto pra busca/impressão. UNIQUE por loja. Reaproveita
     *  `generateShortCode` (32^6 ≈ 1B combos). */
    shortCode: text("short_code").notNull(),

    // ---------------- Cliente ----------------
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    /** CPF ou CNPJ (texto livre — máscara client-side). */
    customerDocument: text("customer_document"),
    customerCity: text("customer_city"),

    // ---------------- Datas ----------------
    // Date-only na UI (hora ignorada). Tipo timestamp pra reuso.
    receivedAt: timestamp("received_at"),
    deliveryAt: timestamp("delivery_at"),

    /** Discriminação: descrição livre da peça, peso, material, observações.
     *  Aparece na borda quadrada da ficha impressa. 1..2000 chars. */
    description: text("description").notNull(),

    // ---------------- Valores ----------------
    totalInCents: integer("total_in_cents").notNull(),
    downPaymentInCents: integer("down_payment_in_cents").notNull().default(0),
    /** Forma livre da entrada: "Pix R$ 500", "12× cartão", "à vista".
     *  Texto orientativo — semântica fica com o lojista. */
    downPaymentNote: text("down_payment_note"),
    /** Auto-calculado pelo client (total − entrada); persistido pra suportar
     *  override manual (ex: cortesia de R$ 30). CHECK >= 0. */
    remainderInCents: integer("remainder_in_cents").notNull(),

    /** Aviso/rodapé livre que entra no fim da ficha impressa. Ex:
     *  "Não nos responsabilizamos por peças deixadas por mais de 90 dias…".
     *  Limite 600 chars. */
    noticeText: text("notice_text"),

    /** Audit: quem criou. NULL aceitável (legado / fichas seed). */
    createdBy: text("created_by").references(() => userTable.id),

    /** Soft-archive — some das listas padrão, preserva histórico. Coerente
     *  com `product.archived_at` (0037). */
    archivedAt: timestamp("archived_at"),
    /** Soft-delete pra cadastros errados. Some até de "arquivados". */
    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeShortCodeUnique: unique("quote_sheet_store_short_code_unique").on(
      t.storeId,
      t.shortCode,
    ),
    storeIdx: index("quote_sheet_store_idx").on(t.storeId, t.createdAt),
    shortCodeIdx: index("quote_sheet_short_code_idx").on(t.shortCode),
  }),
);

export const quoteSheetRelations = relations(quoteSheetTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [quoteSheetTable.storeId],
    references: [storeTable.id],
  }),
  creator: one(userTable, {
    fields: [quoteSheetTable.createdBy],
    references: [userTable.id],
  }),
}));

export type QuoteSheet = typeof quoteSheetTable.$inferSelect;
export type NewQuoteSheet = typeof quoteSheetTable.$inferInsert;
