/**
 * Camada Comercial Mangos Pay — tabelas da ADR-0034 (Camada 1 dado-fonte).
 *
 * Agrupadas neste arquivo pra evitar inflar `order.ts` / `inventory.ts` e
 * manter o domínio comercial localizável. Convive com tabelas existentes:
 *   - order_payment estende order (pagamento dividido)
 *   - supplier / purchase / purchase_item formalizam entrada de mercadoria
 *   - receivable formaliza fiado/crediário
 *
 * Convenções respeitadas (CLAUDE.md):
 *   - RLS-first: toda tabela tem `store_id`. supplier/purchase/receivable
 *     owner-only; order_payment herda via order_id (policy via JOIN).
 *   - Append-only quando possível (order_payment, purchase_item). Correção
 *     via lançamento reverso.
 *   - Snapshot de valores históricos (purchase_item.unit_cost_in_cents).
 *
 * CHECKs em supabase/sql/45_commercial_check_constraints.sql.
 * RLS em supabase/sql/46_commercial_rls.sql.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";
import { productTable, productVariantTable } from "./catalog";
import { customerTable } from "./customer";
import {
  orderPaymentMethodEnum,
  orderTable,
} from "./order";
import { storeTable } from "./store";

// =====================================================================
// order_payment — pagamento dividido (ADR-0034 Camada 1)
// =====================================================================
// Tabela filha de `order`. Múltiplas linhas por pedido permitem dividir
// venda em formas (R$ 80 pix + R$ 70 dinheiro). Reaproveita
// `order_payment_method` enum existente.
//
// CHECK app-layer (NÃO em DB pra não travar updates em flux):
//   SUM(amount_in_cents) == order.total_in_cents - COALESCE(discount,0) + COALESCE(surcharge,0)
//
// Backfill ADR-0034: pra cada order com `payment_method NOT NULL`, gera
// 1 linha em order_payment com method=order.payment_method,
// amount=order.total_in_cents - discount + surcharge,
// cash_received=order.cash_received_in_cents. Ver SQL 47.
//
// `store_id` redundante (poderia herdar via order) mas necessário pra
// RLS via withTenant — policy WHERE store_id = current.
// =====================================================================
export const orderPaymentTable = pgTable(
  "order_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orderTable.id, { onDelete: "cascade" }),

    method: orderPaymentMethodEnum("method").notNull(),
    /** Valor pago nesta linha em centavos. CHECK > 0 no SQL 45. */
    amountInCents: integer("amount_in_cents").notNull(),
    /**
     * Valor recebido em dinheiro nesta linha (pra cálculo de troco quando
     * method='cash'). NULL pra outros métodos. CHECK no SQL 45:
     * method='cash' → pode ter cash_received >= amount; method!=cash →
     * cash_received deve ser NULL.
     */
    cashReceivedInCents: integer("cash_received_in_cents"),
    /**
     * Número de parcelas (cartão de crédito). Default 1 = à vista.
     * Só > 1 quando method='credit'. Range 1..24 (CHECK no SQL 70).
     * Mangos Pay NÃO calcula juros — apenas registra a escolha do lojista.
     * A maquininha do lojista que cobra a taxa do cartão.
     */
    installments: smallint("installments").notNull().default(1),
    /** Notas livres — ex: "últimos 4 dígitos cartão 1234", "comprovante PIX E2E xyz". */
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("order_payment_store_idx").on(t.storeId),
    orderIdx: index("order_payment_order_idx").on(t.orderId),
  }),
);

export const orderPaymentRelations = relations(orderPaymentTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [orderPaymentTable.storeId],
    references: [storeTable.id],
  }),
  order: one(orderTable, {
    fields: [orderPaymentTable.orderId],
    references: [orderTable.id],
  }),
}));

export type OrderPayment = typeof orderPaymentTable.$inferSelect;
export type NewOrderPayment = typeof orderPaymentTable.$inferInsert;

// =====================================================================
// supplier — fornecedor (ADR-0034 Camada 1, expõe em Camada 6)
// =====================================================================
// Cadastro de fornecedor por loja. Document opcional (CPF/CNPJ sem máscara,
// mesma convenção de `customer.document`). RLS owner-only.
// =====================================================================
export const supplierTable = pgTable(
  "supplier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /**
     * CPF (11) ou CNPJ (14) sem máscara. UNIQUE parcial (store, document)
     * WHERE document IS NOT NULL — múltiplos NULL permitidos.
     */
    document: text("document"),
    phone: text("phone"),
    email: text("email"),

    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressZip: text("address_zip"),

    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storeIdx: index("supplier_store_idx").on(t.storeId),
    storeNameIdx: index("supplier_store_name_idx").on(t.storeId, t.name),
    storeCreatedIdx: index("supplier_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
    storeDocumentUnique: unique("supplier_store_document_unique").on(
      t.storeId,
      t.document,
    ),
  }),
);

export const supplierRelations = relations(supplierTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [supplierTable.storeId],
    references: [storeTable.id],
  }),
}));

export type Supplier = typeof supplierTable.$inferSelect;
export type NewSupplier = typeof supplierTable.$inferInsert;

// =====================================================================
// purchase — compra/entrada de fornecedor (ADR-0034 Camada 1)
// =====================================================================
// Cabeçalho da compra. Items na tabela `purchase_item`.
//
// invoice_number = NF do fornecedor ANOTADA — Mangos Pay NÃO emite NF (ADR-0033).
// É só rastro pra contadoria/conferência.
//
// payment_method reaproveita `order_payment_method` — fornecedor recebe
// via mesma lista de formas que a loja oferece.
// =====================================================================
export const purchaseTable = pgTable(
  "purchase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /**
     * Fornecedor (FK SET NULL — apagar fornecedor preserva compra
     * histórica com supplier_id=NULL). Realisticamente, lojista marca
     * supplier como is_active=false em vez de deletar.
     */
    supplierId: uuid("supplier_id").references(() => supplierTable.id, {
      onDelete: "set null",
    }),

    /** Número da NF do fornecedor anotado — texto livre. */
    invoiceNumber: text("invoice_number"),
    /**
     * Total da compra em centavos. Calculado e snapshotado no momento do
     * registro. Pode divergir da soma de purchase_item se houver frete /
     * desconto agregado (campos futuros). CHECK >= 0 no SQL 45.
     */
    totalInCents: integer("total_in_cents").notNull(),

    /**
     * Quando foi pago. NULL = ainda em aberto. Setar paid_at gera
     * cash_adjustment type='pay_supplier' na sessão ativa (app-layer).
     */
    paidAt: timestamp("paid_at"),
    paymentMethod: orderPaymentMethodEnum("payment_method"),

    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => userTable.id),
  },
  (t) => ({
    storeIdx: index("purchase_store_idx").on(t.storeId),
    supplierIdx: index("purchase_supplier_idx").on(t.supplierId),
    storeCreatedIdx: index("purchase_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
  }),
);

export const purchaseRelations = relations(purchaseTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [purchaseTable.storeId],
    references: [storeTable.id],
  }),
  supplier: one(supplierTable, {
    fields: [purchaseTable.supplierId],
    references: [supplierTable.id],
  }),
  createdBy: one(userTable, {
    fields: [purchaseTable.createdByUserId],
    references: [userTable.id],
  }),
  items: many(purchaseItemTable),
}));

export type Purchase = typeof purchaseTable.$inferSelect;
export type NewPurchase = typeof purchaseTable.$inferInsert;

// =====================================================================
// purchase_item — itens da compra (ADR-0034 Camada 1)
// =====================================================================
// Snapshot do custo unitário pra recompor histórico. Ao inserir, gera:
//   1. stock_movement type='manual_in' (Camada 6 — server action)
//   2. UPDATE product.cost_price_in_cents via custo médio móvel ponderado:
//      novo_custo = ((stock_atual * custo_atual) + (qty_nova * custo_novo))
//                   / (stock_atual + qty_nova)
//
// product_id e variant_id são FK SET NULL — apagar produto preserva
// histórico de compra (similar a customer_id em order).
// =====================================================================
export const purchaseItemTable = pgTable(
  "purchase_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchaseTable.id, { onDelete: "cascade" }),

    productId: uuid("product_id").references(() => productTable.id, {
      onDelete: "set null",
    }),
    variantId: uuid("variant_id").references(() => productVariantTable.id, {
      onDelete: "set null",
    }),

    /** Snapshot do nome pra sobreviver a deletes (igual order_item). */
    productNameSnapshot: text("product_name_snapshot").notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),

    quantity: integer("quantity").notNull(),
    /** Custo unitário em centavos. CHECK >= 0 no SQL 45. */
    unitCostInCents: integer("unit_cost_in_cents").notNull(),
    /**
     * Total = quantity * unit_cost_in_cents. Stored generated (calculado
     * no INSERT, persistido pra evitar drift). Gerado via SQL ALTER em
     * supabase/sql/45_*.sql:
     *   GENERATED ALWAYS AS (quantity * unit_cost_in_cents) STORED.
     * Drizzle não tem helper estável pra GENERATED — declaramos como
     * coluna comum aqui e o SQL out-of-band força GENERATED.
     */
    totalCostInCents: integer("total_cost_in_cents").notNull(),

    /**
     * S3.4 (2026-05-26) — lote + validade pra perfumaria/cosmético.
     * NULL = produto sem rastreamento. Index parcial em expires_at IS NOT
     * NULL otimiza dashboard "Vencendo em 60d". CHECK batch <= 60 (SQL 79).
     */
    batchNumber: text("batch_number"),
    expiresAt: date("expires_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    purchaseIdx: index("purchase_item_purchase_idx").on(t.purchaseId),
    productIdx: index("purchase_item_product_idx").on(t.productId),
  }),
);

export const purchaseItemRelations = relations(purchaseItemTable, ({ one }) => ({
  purchase: one(purchaseTable, {
    fields: [purchaseItemTable.purchaseId],
    references: [purchaseTable.id],
  }),
  product: one(productTable, {
    fields: [purchaseItemTable.productId],
    references: [productTable.id],
  }),
  variant: one(productVariantTable, {
    fields: [purchaseItemTable.variantId],
    references: [productVariantTable.id],
  }),
}));

export type PurchaseItem = typeof purchaseItemTable.$inferSelect;
export type NewPurchaseItem = typeof purchaseItemTable.$inferInsert;

// =====================================================================
// receivable — fiado/crediário (ADR-0034 Camada 7)
// =====================================================================
// Operação central do varejo SMB BR. Cliente leva agora, paga depois.
// Vincula a order (venda fiada) OU existe stand-alone (empréstimo em
// dinheiro pro cliente, adiantamento, etc.).
//
// **Customer obrigatório** — fiado anônimo é cobrança impossível. Se PDV
// tenta lançar fiado sem cliente selecionado, app-layer bloqueia.
//
// Status implícito via paid_at:
//   - paid_at IS NULL                       → pendente
//   - paid_at IS NULL AND due_date < now()  → vencido (vista no relatório)
//   - paid_at IS NOT NULL                   → pago
//
// Ao setar paid_at, app-layer gera cash_adjustment type='other_in' na
// sessão de caixa ativa (se houver).
//
// Tabela criada no schema mas exposta em UI só na Camada 7. Schema
// posicionado aqui pra evitar migration adicional depois.
// =====================================================================
export const receivableTable = pgTable(
  "receivable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /**
     * Cliente NOT NULL — fiado anônimo não cobre. ON DELETE SET NULL
     * NÃO se aplica aqui (NOT NULL); se cliente for apagado, app-layer
     * bloqueia delete enquanto houver receivable pendente.
     *
     * Implementação: foreign key sem onDelete (= NO ACTION). Postgres
     * recusa o DELETE do customer. Camada 7 expõe mensagem de erro
     * amigável no UI.
     */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customerTable.id),

    /**
     * FK opcional pra order. NULL = fiado stand-alone (empréstimo,
     * adiantamento, débito histórico que não vem de venda Mangos Pay).
     */
    orderId: uuid("order_id").references(() => orderTable.id, {
      onDelete: "set null",
    }),

    /** Valor pendente em centavos. CHECK > 0 no SQL 45. */
    amountInCents: integer("amount_in_cents").notNull(),
    /** Data de vencimento. NULL = sem vencimento definido. */
    dueDate: timestamp("due_date"),

    /** Quando foi pago. NULL = pendente. */
    paidAt: timestamp("paid_at"),
    /** Forma de pagamento usada pra quitar. NULL enquanto pendente. */
    paidMethod: orderPaymentMethodEnum("paid_method"),

    /**
     * S3.2 (2026-05-26) — overrides por receivable. NULL = herda de
     * store.receivable_default_*. Range 0..9999 bps (SQL 78).
     */
    lateFeeBps: integer("late_fee_bps"),
    interestPerMonthBps: integer("interest_per_month_bps"),

    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => userTable.id),
  },
  (t) => ({
    storeIdx: index("receivable_store_idx").on(t.storeId),
    customerIdx: index("receivable_customer_idx").on(t.customerId),
    orderIdx: index("receivable_order_idx").on(t.orderId),
    /**
     * Hot path: lista de pendentes do tenant, ordenada por vencimento.
     * Index ajuda /admin/financeiro/receber.
     */
    storePendingIdx: index("receivable_store_pending_idx").on(
      t.storeId,
      t.dueDate,
    ),
  }),
);

export const receivableRelations = relations(receivableTable, ({ one, many }) => ({
  store: one(storeTable, {
    fields: [receivableTable.storeId],
    references: [storeTable.id],
  }),
  customer: one(customerTable, {
    fields: [receivableTable.customerId],
    references: [customerTable.id],
  }),
  order: one(orderTable, {
    fields: [receivableTable.orderId],
    references: [orderTable.id],
  }),
  createdBy: one(userTable, {
    fields: [receivableTable.createdByUserId],
    references: [userTable.id],
  }),
  payments: many(receivablePaymentTable),
}));

export type Receivable = typeof receivableTable.$inferSelect;
export type NewReceivable = typeof receivableTable.$inferInsert;

// =====================================================================
// Receivable Payment — Sprint 4A.
//
// Permite pagamento PARCIAL de fiado. 1 receivable -> N payments.
//
// `receivable.paid_at` é DERIVADO (app-layer): seta quando
// SUM(amount_in_cents) dos payments >= amount do receivable. Trigger DB
// rejeitado pra preservar visibilidade/testabilidade (princípio
// CLAUDE.md 5 e 7).
//
// Append-only: SEM UPDATE, SEM DELETE em app. Correção via lançamento
// reverso (futuro — Sprint 4 não inclui estorno).
//
// CHECK amount > 0 + RLS FORCE em supabase/sql/53_receivable_payment.sql.
// =====================================================================
export const receivablePaymentTable = pgTable(
  "receivable_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivableTable.id, { onDelete: "cascade" }),
    /**
     * Pre-Sprint-6 B: CHECK passou de `> 0` pra `<> 0` (SQL 54).
     * Pagamento normal = positivo. Estorno = negativo + reversalOfId NOT NULL.
     */
    amountInCents: integer("amount_in_cents").notNull(),
    method: orderPaymentMethodEnum("method").notNull(),
    notes: text("notes"),
    /**
     * Pre-Sprint-6 B: estorno append-only. NULL = pagamento normal.
     * NOT NULL = aponta pra linha original que está sendo revertida.
     * UNIQUE parcial no DB garante que cada original só pode ter um estorno.
     *
     * FK self-referencing declarada apenas como `uuid` (sem .references())
     * — Drizzle não infere tipo da própria tabela em inicializador. A
     * integridade vem do FK declarado em supabase/sql/54.
     */
    reversalOfId: uuid("reversal_of_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => userTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    receivableIdx: index("receivable_payment_receivable_idx").on(
      t.receivableId,
      t.createdAt,
    ),
    storeCreatedIdx: index("receivable_payment_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
  }),
);

export const receivablePaymentRelations = relations(
  receivablePaymentTable,
  ({ one }) => ({
    store: one(storeTable, {
      fields: [receivablePaymentTable.storeId],
      references: [storeTable.id],
    }),
    receivable: one(receivableTable, {
      fields: [receivablePaymentTable.receivableId],
      references: [receivableTable.id],
    }),
    createdBy: one(userTable, {
      fields: [receivablePaymentTable.createdByUserId],
      references: [userTable.id],
    }),
  }),
);

export type ReceivablePayment = typeof receivablePaymentTable.$inferSelect;
export type NewReceivablePayment = typeof receivablePaymentTable.$inferInsert;

// =====================================================================
// expense — despesas operacionais da loja (S2.1 do Plano de Endurecimento)
// =====================================================================
// Destrava DRE honesto. Sem isso, "Lucro bruto = Receita − CMV" mente
// em 10-25% pra cima porque ignora aluguel, salário, comissão, taxa real
// de cartão. Veja docs/PLANO-ENDURECIMENTO.md §S2.1.
// SQL: supabase/sql/75_expense_table.sql.

export const expenseCategoryEnum = pgEnum("expense_category", [
  "rent",
  "payroll",
  "utilities",
  "supplies",
  "marketing",
  "tax",
  "card_fees",
  "other",
]);

export const expenseTable = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => userTable.id, { onDelete: "restrict" }),

    category: expenseCategoryEnum("category").notNull().default("other"),
    amountInCents: integer("amount_in_cents").notNull(),
    /** Data efetiva de pagamento. NULL = pendente. */
    paidAt: date("paid_at"),
    /** Vencimento. NULL = pagamento à vista no momento. */
    dueDate: date("due_date"),
    supplierId: uuid("supplier_id").references(() => supplierTable.id, {
      onDelete: "set null",
    }),
    /** true = veio de "Repetir mensalmente". App gera 12 entries no INSERT. */
    recurring: boolean("recurring").notNull().default(false),
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    storePaidAtIdx: index("expense_store_paid_at_idx").on(t.storeId, t.paidAt),
    storeCategoryIdx: index("expense_store_category_idx").on(
      t.storeId,
      t.category,
    ),
  }),
);

export const expenseRelations = relations(expenseTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [expenseTable.storeId],
    references: [storeTable.id],
  }),
  supplier: one(supplierTable, {
    fields: [expenseTable.supplierId],
    references: [supplierTable.id],
  }),
  createdBy: one(userTable, {
    fields: [expenseTable.createdBy],
    references: [userTable.id],
  }),
}));

export type Expense = typeof expenseTable.$inferSelect;
export type NewExpense = typeof expenseTable.$inferInsert;

// Sentinel pra evitar tree-shaking matar imports e quebrar tipo Drizzle
// quando alguma das tabelas acima for usada apenas via relation
export const _commercialSchemaSentinel = sql`1`;
