/**
 * Movimentação de estoque event-sourced (Fase 4 — ADR-0015).
 *
 * `stock_movement` é a FONTE DE VERDADE. `product.stock_quantity` e
 * `product_variant.stock_quantity` viram cache denormalizado, atualizado
 * automaticamente por trigger SQL `sync_stock_cache_on_movement` (ver
 * supabase/sql/24_*).
 *
 * Append-only — não permitimos UPDATE/DELETE em movements. Correção de
 * erro = lançar `adjustment` reverso, não editar histórico.
 *
 * Storefront NÃO lê esta tabela (RLS tenant_isolation owner-only + INSERT
 * anônimo restrito a `sale` com `reference_type='order'` — ver SQL 23).
 */
import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { productTable, productVariantTable } from "./catalog";
import { storeTable } from "./store";

/**
 * Tipo de movimento. Semântica explícita — não reusar entradas pra
 * "cobrir" cenários novos. Adicionar valor novo se aparecer caso real.
 *
 *   - initial:     saldo inicial (cadastro de produto ou backfill ADR-0015)
 *   - manual_in:   entrada manual (compra de fornecedor, devolução de cliente)
 *   - manual_out:  saída manual (perda, dano, doação)
 *   - sale:        venda confirmada (storefront WhatsApp e, Fase 5, balcão)
 *   - return:      devolução automática em cancel/expire de pedido
 *   - adjustment:  ajuste de inventário (contagem física vs sistema)
 */
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "initial",
  "manual_in",
  "manual_out",
  "sale",
  "return",
  "adjustment",
]);

export const stockMovementTable = pgTable(
  "stock_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    // Produto sempre presente. Variant nullable — produto sem variantes
    // tem stock no product; com variantes, é por variant (mesma regra
    // já vigente em create-from-cart pré-Fase 4).
    productId: uuid("product_id")
      .notNull()
      .references(() => productTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariantTable.id, {
      onDelete: "cascade",
    }),

    movementType: stockMovementTypeEnum("movement_type").notNull(),

    // Signed delta. Positivo = entrada, negativo = saída. SUM(delta)
    // GROUP BY product_id reconstrói saldo, sem condicional. CHECK
    // delta != 0 no SQL out-of-band.
    quantityDelta: integer("quantity_delta").notNull(),

    // Origem do movimento. Hoje aceitamos "order" e "manual"; "balcao"
    // entra na Fase 5 (PDV) via ALTER no CHECK.
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),

    // Texto livre — "fornecedor X NF 12345", "achei 2 peças na gaveta".
    // CHECK length <= 500 no SQL.
    notes: text("notes"),

    // Quem registrou. NULL pra sale via storefront (checkout anônimo).
    createdBy: text("created_by"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Hot path: SUM por produto + relatório por produto/janela
    productIdx: index("stock_movement_product_idx").on(
      t.storeId,
      t.productId,
      t.createdAt,
    ),
    // Relatório por janela temporal (KPI da rota /admin/estoque)
    storeCreatedIdx: index("stock_movement_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
    // Lookup por origem (cancela pedido → encontra os sale movements)
    referenceIdx: index("stock_movement_reference_idx").on(
      t.referenceType,
      t.referenceId,
    ),
  }),
);

export const stockMovementRelations = relations(stockMovementTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [stockMovementTable.storeId],
    references: [storeTable.id],
  }),
  product: one(productTable, {
    fields: [stockMovementTable.productId],
    references: [productTable.id],
  }),
  variant: one(productVariantTable, {
    fields: [stockMovementTable.variantId],
    references: [productVariantTable.id],
  }),
}));

export type StockMovement = typeof stockMovementTable.$inferSelect;
export type NewStockMovement = typeof stockMovementTable.$inferInsert;
