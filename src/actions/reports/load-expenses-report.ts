"use server";

/**
 * loadExpensesReport — Onda Relatórios A4 (2026-05-29).
 *
 * Lista despesa-a-despesa do período + agregação por categoria.
 * Usado em /admin/relatorios/despesas. Lojista usa pra:
 *   - "Quanto gastei de aluguel ano todo?" (filtro category=rent, periodo=ano)
 *   - "Quanto saiu esse mês?" (default — periodo=mes)
 *   - "Quais despesas se repetem?" (recurring=true)
 *
 * Filtros URL canônicos (mesma convenção dos outros relatórios):
 *   ?periodo=hoje|semana|mes|trimestre|ano|7|30|90|custom
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD   (custom)
 *   ?category=rent|payroll|utilities|supplies|marketing|tax|card_fees|other
 *   ?paid=all|paid|pending
 *   ?recurring=all|yes|no
 *
 * Range de despesa = data efetiva quando paga, senão data de vencimento.
 * Mesma convenção do `loadExpenses` (a tela /admin/financeiro?tab=pagar).
 */
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  CATEGORY_LABEL_BR,
  type ExpenseCategory,
  EXPENSE_CATEGORIES,
} from "@/actions/expense/schema";
import { expenseTable, supplierTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type { ReportRange } from "./types";

export interface ExpensesReportRow {
  id: string;
  category: ExpenseCategory;
  categoryLabel: string;
  amountInCents: number;
  /** Data de pagamento (YYYY-MM-DD) ou null se ainda em aberto. */
  paidAt: string | null;
  /** Data de vencimento (YYYY-MM-DD). Pode ser null se foi cadastrada
   *  só como pagamento à vista sem vencimento. */
  dueDate: string | null;
  supplierName: string | null;
  recurring: boolean;
  notes: string | null;
}

export interface ExpensesByCategoryRow {
  category: ExpenseCategory;
  label: string;
  count: number;
  sumInCents: number;
  /** Participação no total geral, 0..100. Null se total = 0. */
  sharePct: number | null;
}

export interface ExpensesReportSummary {
  totalPaidInCents: number;
  totalPendingInCents: number;
  totalAllInCents: number;
  paidCount: number;
  pendingCount: number;
  recurringCount: number;
  recurringSumInCents: number;
  byCategory: ExpensesByCategoryRow[];
}

export interface LoadExpensesReportInput {
  filters: Record<string, string | undefined>;
}

export interface LoadExpensesReportOutput {
  range: ReportRange;
  rows: ExpensesReportRow[];
  summary: ExpensesReportSummary;
}

function parseCategory(v: string | undefined): ExpenseCategory | null {
  if (!v) return null;
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v)
    ? (v as ExpenseCategory)
    : null;
}

function parsePaid(v: string | undefined): "all" | "paid" | "pending" {
  return v === "paid" || v === "pending" ? v : "all";
}

function parseRecurring(v: string | undefined): "all" | "yes" | "no" {
  return v === "yes" || v === "no" ? v : "all";
}

export async function loadExpensesReport(
  input: LoadExpensesReportInput,
): Promise<LoadExpensesReportOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(input.filters);
  const category = parseCategory(input.filters.category);
  const paid = parsePaid(input.filters.paid);
  const recurring = parseRecurring(input.filters.recurring);

  // Range em formato DATE (YYYY-MM-DD) porque a query compara contra
  // `coalesce(paid_at, due_date)` que são colunas DATE no banco.
  const fromIso = range.start.toISOString().slice(0, 10);
  const toIso = range.end.toISOString().slice(0, 10);

  return withTenant(store.id, session.user.id, async (tx) => {
    const conds = [
      eq(expenseTable.storeId, store.id),
      sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate}) >= ${fromIso}`,
      sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate}) <= ${toIso}`,
    ];
    if (category) conds.push(eq(expenseTable.category, category));
    if (paid === "paid") conds.push(isNotNull(expenseTable.paidAt));
    if (paid === "pending") conds.push(isNull(expenseTable.paidAt));
    if (recurring === "yes") conds.push(eq(expenseTable.recurring, true));
    if (recurring === "no") conds.push(eq(expenseTable.recurring, false));

    const where = and(...conds);

    const rawRows = await tx
      .select({
        id: expenseTable.id,
        category: expenseTable.category,
        amountInCents: expenseTable.amountInCents,
        paidAt: expenseTable.paidAt,
        dueDate: expenseTable.dueDate,
        recurring: expenseTable.recurring,
        notes: expenseTable.notes,
        supplierName: supplierTable.name,
      })
      .from(expenseTable)
      .leftJoin(
        supplierTable,
        and(
          eq(supplierTable.id, expenseTable.supplierId),
          eq(supplierTable.storeId, store.id),
        ),
      )
      .where(where)
      .orderBy(
        // Mais recentes em cima — data efetiva primeiro, fallback createdAt
        // pra empates (lojista lançou 3 despesas no mesmo dia).
        desc(sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate})`),
        desc(expenseTable.createdAt),
      )
      .limit(2000);

    const rows: ExpensesReportRow[] = rawRows.map((r) => ({
      id: r.id,
      category: r.category as ExpenseCategory,
      categoryLabel: CATEGORY_LABEL_BR[r.category as ExpenseCategory],
      amountInCents: r.amountInCents,
      paidAt: r.paidAt,
      dueDate: r.dueDate,
      supplierName: r.supplierName,
      recurring: r.recurring,
      notes: r.notes,
    }));

    // Agregação global: total pago, em aberto, contagens.
    const [aggRow] = await tx
      .select({
        paid: sql<number>`coalesce(sum(${expenseTable.amountInCents}) filter (where ${expenseTable.paidAt} is not null), 0)::int`,
        pending: sql<number>`coalesce(sum(${expenseTable.amountInCents}) filter (where ${expenseTable.paidAt} is null), 0)::int`,
        paidCount: sql<number>`coalesce(count(*) filter (where ${expenseTable.paidAt} is not null), 0)::int`,
        pendingCount: sql<number>`coalesce(count(*) filter (where ${expenseTable.paidAt} is null), 0)::int`,
        recurringCount: sql<number>`coalesce(count(*) filter (where ${expenseTable.recurring} = true), 0)::int`,
        recurringSum: sql<number>`coalesce(sum(${expenseTable.amountInCents}) filter (where ${expenseTable.recurring} = true), 0)::int`,
      })
      .from(expenseTable)
      .where(where);

    const totalPaidInCents = aggRow?.paid ?? 0;
    const totalPendingInCents = aggRow?.pending ?? 0;
    const totalAllInCents = totalPaidInCents + totalPendingInCents;

    // Agregação por categoria — pra UI "Aluguel R$ 3.000 (40%)".
    const catRows = await tx
      .select({
        category: expenseTable.category,
        count: sql<number>`count(*)::int`,
        sumInCents: sql<number>`coalesce(sum(${expenseTable.amountInCents}), 0)::int`,
      })
      .from(expenseTable)
      .where(where)
      .groupBy(expenseTable.category)
      .orderBy(asc(expenseTable.category));

    const byCategory: ExpensesByCategoryRow[] = catRows
      .map((r) => ({
        category: r.category as ExpenseCategory,
        label: CATEGORY_LABEL_BR[r.category as ExpenseCategory],
        count: Number(r.count),
        sumInCents: Number(r.sumInCents),
        sharePct:
          totalAllInCents > 0
            ? Math.round((Number(r.sumInCents) / totalAllInCents) * 1000) / 10
            : null,
      }))
      // Ordena por valor descendente — categoria mais cara primeiro.
      .sort((a, b) => b.sumInCents - a.sumInCents);

    return {
      range,
      rows,
      summary: {
        totalPaidInCents,
        totalPendingInCents,
        totalAllInCents,
        paidCount: aggRow?.paidCount ?? 0,
        pendingCount: aggRow?.pendingCount ?? 0,
        recurringCount: aggRow?.recurringCount ?? 0,
        recurringSumInCents: aggRow?.recurringSum ?? 0,
        byCategory,
      },
    };
  });
}
