/**
 * Pedidos e itens. orderItem snapshota produto/variante para sobreviver a deletes.
 * Estados: awaiting_whatsapp -> confirmed -> fulfilled | canceled | expired
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { cashSessionTable } from "./cash";
import { customerTable } from "./customer";
import { storeTable } from "./store";

export const orderStatusEnum = pgEnum("order_status", [
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
  "canceled",
  "expired",
]);

/**
 * Canal de origem da venda (Fase 5 — ADR-0016).
 *   - whatsapp: checkout do storefront público (carrinho → WhatsApp)
 *   - balcao:   venda registrada no /admin/pdv pelo lojista
 *
 * Default 'whatsapp' pra preservar comportamento de pedidos pré-PDV.
 */
export const orderChannelEnum = pgEnum("order_channel", [
  "whatsapp",
  "balcao",
]);

/**
 * Método de pagamento informado pelo lojista no PDV (Fase 5 — ADR-0016).
 * APENAS metadado — Vitrê não processa cartão; o lojista usa POS físico
 * próprio e registra aqui o que foi cobrado, pra reconciliação/relatório.
 *
 *   - cash:   dinheiro (pode acompanhar cash_received_in_cents pra troco)
 *   - pix:    transferência PIX
 *   - debit:  débito (POS físico do lojista)
 *   - credit: crédito (POS físico do lojista)
 *   - other:  cheque/fiado/vale — campo notes do pedido cobre detalhes
 *
 * NULL para pedidos do canal whatsapp (pagamento combinado no chat).
 */
export const orderPaymentMethodEnum = pgEnum("order_payment_method", [
  "cash",
  "pix",
  "debit",
  "credit",
  "other",
]);

// =====================================================================
// Order
// =====================================================================
// Index composto (store_id, created_at DESC) para o listing /admin/pedidos
// vive em supabase/sql/05_indexes_for_scale.sql (substitui o antigo
// `order_created_idx` que indexava só created_at).
//
// CHECK total_in_cents >= 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const orderTable = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortCode: text("short_code").notNull().unique(), // "A7K2"
    publicToken: text("public_token").notNull().unique(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /**
     * Idempotency key gerada pelo client (crypto.randomUUID()) no mount
     * do checkout. Server faz INSERT ON CONFLICT (storeId, idempotencyKey)
     * DO NOTHING — duplo-clique não cria pedidos duplicados.
     * Aplicada via supabase/sql/03_order_idempotency.sql.
     */
    idempotencyKey: text("idempotency_key").notNull(),

    customerName: text("customer_name").notNull(),
    /**
     * E.164 (Fase 5/ADR-0016): nullable pra cobrir venda balcão walk-in
     * sem cliente vinculado. CHECK do SQL 12 já permite NULL.
     * Storefront WhatsApp continua exigindo via Zod (action valida).
     */
    customerPhone: text("customer_phone"),
    customerNotes: text("customer_notes"),
    /**
     * FK opcional para `customer` (Fase 3 — ADR-0014). NULL para pedidos
     * antigos e pedidos do storefront cuja compradora não está cadastrada
     * no admin. ON DELETE SET NULL — apagar cliente NÃO apaga pedido
     * histórico; pedido fica órfão de vínculo mas mantém os snapshots
     * `customer_name`/`customer_phone` da época da compra.
     *
     * NÃO substitui os snapshots. Snapshot = imutável (forma como o
     * cliente se chamou naquela compra). FK = vínculo ativo (cliente
     * pode mudar nome depois sem afetar o pedido velho).
     */
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "set null",
    }),

    totalInCents: integer("total_in_cents").notNull(),

    status: orderStatusEnum("status").notNull().default("awaiting_whatsapp"),

    /**
     * Canal de origem (Fase 5 — ADR-0016). Default 'whatsapp' preserva
     * comportamento de pedidos pré-PDV; SQL 26 (CHECK) garante que
     * `channel='balcao'` exige payment_method NOT NULL.
     */
    channel: orderChannelEnum("channel").notNull().default("whatsapp"),
    /** Fase 5 — apenas metadado. Vitrê não processa cartão. */
    paymentMethod: orderPaymentMethodEnum("payment_method"),
    /** Fase 5 — desconto manual no balcão (em centavos). */
    discountInCents: integer("discount_in_cents"),
    /**
     * ADR-0020 — acréscimo manual no balcão (taxa cartão, frete, embalagem,
     * "fechar redondo"). Simétrico a discount_in_cents. NULL = sem acréscimo.
     * CHECK >= 0 via supabase/sql/27_pdv_surcharge_check.sql.
     */
    surchargeInCents: integer("surcharge_in_cents"),
    /** Fase 5 — valor recebido em dinheiro (pra cálculo de troco). */
    cashReceivedInCents: integer("cash_received_in_cents"),

    /**
     * ADR-0022 — FK opcional para `cash_session`. Vendas balcão durante
     * uma sessão de caixa ativa recebem o ID automaticamente (auto-attach
     * em createBalcaoSale). NULL pra:
     *   - Vendas balcão feitas sem caixa aberto (ADR-0022 D1 = opt-in)
     *   - TODAS vendas channel='whatsapp' (canal não passa por caixa físico)
     * ON DELETE SET NULL — sessão deletada (cascade da store) NÃO apaga
     * pedido histórico.
     */
    cashSessionId: uuid("cash_session_id").references(
      () => cashSessionTable.id,
      { onDelete: "set null" },
    ),

    whatsappOpenedAt: timestamp("whatsapp_opened_at"),
    confirmedAt: timestamp("confirmed_at"),
    /**
     * Pedido whatsapp expira se cliente não confirma dentro da janela
     * configurada. PDV (channel='balcao') nasce status='fulfilled' e
     * passa expires_at = createdAt (irrelevante mas mantido por hábito
     * dos call-sites que tocam timestamps; tornar nullable evita CHECK
     * adicional). Pedido whatsapp continua exigindo Zod no caller.
     */
    expiresAt: timestamp("expires_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("order_store_idx").on(t.storeId),
    statusIdx: index("order_status_idx").on(t.storeId, t.status),
    // `order_created_idx` (apenas created_at) foi removido em 05 — o composto
    // `order_store_created_idx` vive em SQL (não declarado aqui pra não
    // duplicar). Listing real sempre filtra por store_id, então a versão
    // composta é estritamente melhor.
    storeIdempotencyUnique: unique("order_store_idempotency_unique").on(
      t.storeId,
      t.idempotencyKey,
    ),
  }),
);

export const orderRelations = relations(orderTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [orderTable.storeId],
    references: [storeTable.id],
  }),
  customer: one(customerTable, {
    fields: [orderTable.customerId],
    references: [customerTable.id],
  }),
  items: many(orderItemTable),
}));

export type Order = typeof orderTable.$inferSelect;
export type NewOrder = typeof orderTable.$inferInsert;

// =====================================================================
// Order Item
// =====================================================================
// CHECK quantity > 0 em supabase/sql/07_check_constraints.sql.
// =====================================================================
export const orderItemTable = pgTable(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orderTable.id, { onDelete: "cascade" }),

    // SNAPSHOT — não-FK para sobreviver a deletes
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),
    imageUrlSnapshot: text("image_url_snapshot"),
    priceInCentsSnapshot: integer("price_in_cents_snapshot").notNull(),

    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("order_item_order_idx").on(t.orderId),
  }),
);

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderItemTable.orderId],
    references: [orderTable.id],
  }),
}));

export type OrderItem = typeof orderItemTable.$inferSelect;
export type NewOrderItem = typeof orderItemTable.$inferInsert;
