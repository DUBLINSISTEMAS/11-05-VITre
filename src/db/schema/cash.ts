/**
 * Tabelas `cash_session` + `cash_adjustment` — caixa formal (ADR-0022).
 *
 * NÃO confundir com `/admin/pdv/caixa` legado (conferência read-only de
 * vendas balcão do dia, Onda A.12). Cash session é o registro formal
 * de abertura → vendas/ajustes → fechamento Z.
 *
 * Convenções respeitadas:
 *   - RLS-first (CLAUDE.md #1): `withTenant(storeId)` em todas queries.
 *     `cash_adjustment` não carrega `store_id` direto — herda via
 *     `cash_session_id` (JOIN). Policy faz EXISTS check em SQL 29.
 *   - Apenas UMA sessão aberta por loja — UNIQUE PARTIAL em SQL 29
 *     (`WHERE closed_at IS NULL`).
 *   - Sessão fechada é imutável (ADR-0022 D2 = bloqueia reabrir).
 *     Garantia em app-layer (server actions checam closed_at antes
 *     de UPDATE/INSERT adjustment).
 *
 * CHECK constraints em supabase/sql/29_cash_session_constraints.sql.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";
import { storeTable } from "./store";

/**
 * ADR-0022 D3 — tabela separada `cash_adjustment` em vez de `cash_movement`
 * unificado. Sale fica em `order` (já existe via ADR-0016). Adjustment é
 * sangria (saída pra cofre/banco) ou reforço (entrada extra de troco).
 */
export const cashAdjustmentTypeEnum = pgEnum("cash_adjustment_type", [
  "sangria",
  "reinforcement",
]);

export const cashSessionTable = pgTable(
  "cash_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    /** Quem abriu a sessão. Snapshot pra audit em B4.2 Equipe. */
    openedByUserId: text("opened_by_user_id")
      .notNull()
      .references(() => userTable.id),
    openedAt: timestamp("opened_at").notNull().defaultNow(),
    /**
     * Troco inicial em centavos. >= 0 (CHECK SQL 29). Zero é válido
     * (lojista que abre sem trocado).
     */
    openingAmountInCents: integer("opening_amount_in_cents").notNull(),

    /** Fechamento — todos NULL enquanto sessão aberta. */
    closedByUserId: text("closed_by_user_id").references(() => userTable.id),
    closedAt: timestamp("closed_at"),
    /**
     * Esperado = opening + vendas_cash + reforço - sangria.
     * Calculado no momento do fechamento (server-side) e gravado pra
     * snapshot histórico. NÃO recomputar — vendas/adjustments podem
     * ser deletados? Não, RLS bloqueia DELETE em sessão fechada.
     * Ainda assim, snapshot é mais seguro pra Z imprimível.
     */
    closingExpectedInCents: integer("closing_expected_in_cents"),
    /** Contagem física do lojista no fechamento. */
    closingActualInCents: integer("closing_actual_in_cents"),
    /**
     * Motivo da diferença. ADR-0022 D5 — obrigatório em app-layer se
     * `closing_expected != closing_actual`. NULL quando diferença = 0.
     */
    closingNotes: text("closing_notes"),
  },
  (t) => ({
    // Listagem default `/admin/pdv/caixa` ordena por openedAt desc —
    // índice composto evita sort full.
    storeOpenedIdx: index("cash_session_store_opened_idx").on(
      t.storeId,
      t.openedAt,
    ),
    // Lookup "sessão ativa da loja" via WHERE closed_at IS NULL —
    // UNIQUE PARTIAL em SQL 29 também faz o trabalho de index parcial.
  }),
);

export const cashAdjustmentTable = pgTable(
  "cash_adjustment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessionTable.id, { onDelete: "cascade" }),

    type: cashAdjustmentTypeEnum("type").notNull(),
    /** Valor positivo em centavos (CHECK >= 0 em SQL 29). Sinal vem do `type`. */
    amountInCents: integer("amount_in_cents").notNull(),
    /** Motivo livre. Opcional mas fortemente recomendado pra audit. */
    reason: text("reason"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => userTable.id),
  },
  (t) => ({
    sessionCreatedIdx: index("cash_adjustment_session_created_idx").on(
      t.cashSessionId,
      t.createdAt,
    ),
  }),
);

export const cashSessionRelations = relations(
  cashSessionTable,
  ({ one, many }) => ({
    store: one(storeTable, {
      fields: [cashSessionTable.storeId],
      references: [storeTable.id],
    }),
    openedBy: one(userTable, {
      fields: [cashSessionTable.openedByUserId],
      references: [userTable.id],
      relationName: "cash_session_opened_by",
    }),
    closedBy: one(userTable, {
      fields: [cashSessionTable.closedByUserId],
      references: [userTable.id],
      relationName: "cash_session_closed_by",
    }),
    adjustments: many(cashAdjustmentTable),
  }),
);

export const cashAdjustmentRelations = relations(
  cashAdjustmentTable,
  ({ one }) => ({
    session: one(cashSessionTable, {
      fields: [cashAdjustmentTable.cashSessionId],
      references: [cashSessionTable.id],
    }),
    createdBy: one(userTable, {
      fields: [cashAdjustmentTable.createdByUserId],
      references: [userTable.id],
    }),
  }),
);

export type CashSession = typeof cashSessionTable.$inferSelect;
export type NewCashSession = typeof cashSessionTable.$inferInsert;
export type CashAdjustment = typeof cashAdjustmentTable.$inferSelect;
export type NewCashAdjustment = typeof cashAdjustmentTable.$inferInsert;
export type CashAdjustmentType =
  (typeof cashAdjustmentTypeEnum.enumValues)[number];
