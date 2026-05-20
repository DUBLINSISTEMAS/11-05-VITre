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

import { userTable } from "./auth";
import { cashSessionTable } from "./cash";
import { couponTable } from "./coupon";
import { customerTable } from "./customer";
import { storeTable } from "./store";

export const orderStatusEnum = pgEnum("order_status", [
  // Sprint 1A Fase 4 — orçamento sem pagamento, sem desconto de estoque.
  // Posicionado antes de awaiting_whatsapp pra refletir cronologia natural
  // (orçamento vira venda quando lojista fecha). Espelha SQL 50.
  "quote",
  "awaiting_whatsapp",
  "confirmed",
  "fulfilled",
  "canceled",
  "expired",
  // Pre-Sprint-6 C — devolução de venda balcão. Difere de 'canceled':
  // canceled = venda nunca aconteceu de fato (cliente desistiu antes
  // da entrega). returned = venda aconteceu, cliente trouxe de volta.
  // Espelha SQL 55.
  "returned",
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

/**
 * ADR-0034 Camada 1 — tabela de preço aplicada no pedido. NULL pra canais
 * que não usam tabela (whatsapp herda preço do catálogo público). NOT NULL
 * obrigatório no app-layer pra `channel='balcao'`.
 *
 *   - retail:    varejo (preço de venda padrão)
 *   - wholesale: atacado (preço alternativo configurado no produto)
 *   - promo:     promoção ativa (lojista escolheu aplicar o preço promocional)
 */
export const orderPriceTableEnum = pgEnum("order_price_table", [
  "retail",
  "wholesale",
  "promo",
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
    /**
     * Fase 5 — apenas metadado. Vitrê não processa cartão.
     *
     * @deprecated ADR-0034 Camada 1 — migrar pra tabela filha
     * `order_payment` (pagamento dividido). Coluna fica por 2 release
     * cycles após Camada 1 fechar (backfill já populou order_payment) e
     * então é removida em ADR de cleanup futuro. Novas escritas devem
     * popular APENAS order_payment; leituras transitórias podem cair
     * neste campo se order_payment estiver vazia (pedido antigo).
     */
    paymentMethod: orderPaymentMethodEnum("payment_method"),
    /** Fase 5 — desconto manual no balcão (em centavos). */
    discountInCents: integer("discount_in_cents"),
    /**
     * ADR-0020 — acréscimo manual no balcão (taxa cartão, frete, embalagem,
     * "fechar redondo"). Simétrico a discount_in_cents. NULL = sem acréscimo.
     * CHECK >= 0 via supabase/sql/27_pdv_surcharge_check.sql.
     */
    surchargeInCents: integer("surcharge_in_cents"),
    /**
     * Fase 5 — valor recebido em dinheiro (pra cálculo de troco).
     *
     * @deprecated ADR-0034 Camada 1 — migrar pra `order_payment.cash_received_in_cents`
     * na linha de method='cash'. Mesma estratégia de transição do
     * `paymentMethod` acima.
     */
    cashReceivedInCents: integer("cash_received_in_cents"),

    /**
     * ADR-0034 Camada 1 — vendedor responsável pela venda (FK para
     * `user.id`, Better Auth). NULL pra:
     *   - Pedidos whatsapp (sem vendedor — autoatendimento storefront)
     *   - Backfill de pedidos balcão pré-Camada 1
     * Validation no app-layer força NOT NULL pra channel='balcao'
     * quando existe ≥1 store_membership ativo (ou seja, equipe ativa).
     * Lojista solo continua sem obrigação.
     *
     * ON DELETE SET NULL: vendedor que sai da equipe NÃO apaga pedidos
     * históricos — apenas perde o vínculo. Snapshot do nome do vendedor
     * pode ser adicionado em coluna futura se relatório precisar.
     */
    sellerId: text("seller_id").references(() => userTable.id, {
      onDelete: "set null",
    }),

    /**
     * ADR-0034 Camada 1 + ADR-0033 D2 — campo livre onde lojista anota
     * número da NF emitida em OUTRO sistema (Bling, contadora, emissor da
     * prefeitura). Vitrê NÃO emite NF. Texto cru, sem máscara, sem
     * validação SEFAZ.
     */
    externalFiscalDoc: text("external_fiscal_doc"),

    /**
     * ADR-0034 Camada 1 — tabela de preço aplicada na venda. NULL pra
     * whatsapp (storefront usa preço público). NOT NULL no app-layer
     * pra balcão. Permite relatório "vendas no atacado vs varejo".
     */
    priceTableUsed: orderPriceTableEnum("price_table_used"),

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

    /**
     * ADR-0026 / fix auditoria 2026-05-18 — FK opcional para `coupon`.
     * NULL quando venda não usou cupom (incluindo desconto manual no PDV
     * sem cupom). ON DELETE SET NULL preserva o pedido histórico se o
     * cupom for deletado depois (auditoria via tabela coupon mantém
     * trilha; desconto aplicado permanece na coluna discount_in_cents).
     *
     * Snapshot do código NÃO é gravado — usuário do PDV recompõe via
     * JOIN. Se cupom é renomeado, ID continua válido.
     *
     * Incremento de uses_count é atomic (WHERE uses_count < max_uses) no
     * mesmo tx do INSERT order — ver coupon/internal.ts incrementCouponUsesTx.
     */
    couponId: uuid("coupon_id").references(() => couponTable.id, {
      onDelete: "set null",
    }),

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

    /**
     * Sprint 1A Fase 4 — validade do orçamento (status='quote'). Default
     * created_at + 7 days, configurável via `quoteValidityDays` no input
     * da action. NULL quando status != 'quote'. App-layer garante a
     * coerência (sem CHECK pra não travar updates de transição de status).
     */
    quoteValidUntil: timestamp("quote_valid_until"),

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
  coupon: one(couponTable, {
    fields: [orderTable.couponId],
    references: [couponTable.id],
  }),
  seller: one(userTable, {
    fields: [orderTable.sellerId],
    references: [userTable.id],
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

    /**
     * ADR-0034 Camada 1 — snapshot do custo unitário NO MOMENTO da venda.
     * Sem isso, margem histórica reescreve quando lojista reajusta o
     * preço de custo do produto (custo médio móvel de novas compras
     * altera product.cost_price_in_cents).
     *
     * NULL pra itens antigos (backfill defere) e pra produtos sem
     * cost_price_in_cents preenchido na hora da venda — relatório de
     * margem trata NULL como "custo desconhecido", não como 0.
     */
    unitCostSnapshotInCents: integer("unit_cost_snapshot_in_cents"),

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

// =====================================================================
// OrderReturn — Pre-Sprint-6 C.
//
// Devolução de venda balcão (cliente trouxe a peça de volta). V1 só
// aceita devolução TOTAL (`return_type='full'`); v2 expõe parcial via
// `order_return_item` qty variável.
//
// Modelo append-only: 1 order tem no máximo 1 devolução do tipo 'full'
// (UNIQUE parcial no DB, SQL 55). Múltiplas parciais permitidas em v2.
//
// Efeitos colaterais gerenciados pelo app (não trigger DB):
//   - stock_movement type='return' por item (via helper restockOrderItems)
//   - order.status = 'returned'
//   - cash_adjustment 'other_out' no caixa aberto (espelho da entrada)
// =====================================================================
export const orderReturnTypeEnum = pgEnum("order_return_type", [
  "full",
  "partial",
]);

export const orderReturnTable = pgTable(
  "order_return",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orderTable.id, { onDelete: "restrict" }),
    returnType: orderReturnTypeEnum("return_type").notNull().default("full"),
    /** Total devolvido em centavos. CHECK > 0 no SQL 55. */
    refundedInCents: integer("refunded_in_cents").notNull(),
    /** Motivo livre (min 3, max 500). Obrigatório. CHECK no SQL 55. */
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => userTable.id),
    /** Cash adjustment gerado quando havia caixa aberto. NULL caso contrário. */
    cashAdjustmentId: uuid("cash_adjustment_id"),
  },
  (t) => ({
    orderIdx: index("order_return_order_idx").on(t.orderId, t.createdAt),
    storeCreatedIdx: index("order_return_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
  }),
);

export const orderReturnRelations = relations(orderReturnTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [orderReturnTable.storeId],
    references: [storeTable.id],
  }),
  order: one(orderTable, {
    fields: [orderReturnTable.orderId],
    references: [orderTable.id],
  }),
  items: many(orderReturnItemTable),
  createdBy: one(userTable, {
    fields: [orderReturnTable.createdByUserId],
    references: [userTable.id],
  }),
}));

export type OrderReturn = typeof orderReturnTable.$inferSelect;
export type NewOrderReturn = typeof orderReturnTable.$inferInsert;

export const orderReturnItemTable = pgTable(
  "order_return_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderReturnId: uuid("order_return_id")
      .notNull()
      .references(() => orderReturnTable.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItemTable.id, { onDelete: "restrict" }),
    quantityReturned: integer("quantity_returned").notNull(),
    refundedInCents: integer("refunded_in_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    returnIdx: index("order_return_item_return_idx").on(t.orderReturnId),
    orderItemIdx: index("order_return_item_order_item_idx").on(t.orderItemId),
  }),
);

export const orderReturnItemRelations = relations(
  orderReturnItemTable,
  ({ one }) => ({
    return: one(orderReturnTable, {
      fields: [orderReturnItemTable.orderReturnId],
      references: [orderReturnTable.id],
    }),
    orderItem: one(orderItemTable, {
      fields: [orderReturnItemTable.orderItemId],
      references: [orderItemTable.id],
    }),
  }),
);

export type OrderReturnItem = typeof orderReturnItemTable.$inferSelect;
export type NewOrderReturnItem = typeof orderReturnItemTable.$inferInsert;
