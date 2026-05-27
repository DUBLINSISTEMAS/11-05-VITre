"use server";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { expenseTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type ExpenseCategory,
  type ListExpensesInput,
  listExpensesSchema,
} from "./schema";

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amountInCents: number;
  paidAt: string | null;
  dueDate: string | null;
  supplierId: string | null;
  recurring: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface LoadExpensesResult {
  items: ExpenseRow[];
  totalPaidInCents: number;
  totalPendingInCents: number;
}

export async function loadExpenses(
  input: ListExpensesInput = {} as ListExpensesInput,
): Promise<LoadExpensesResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { items: [], totalPaidInCents: 0, totalPendingInCents: 0 };
  }
  const userId = session.user.id;

  const filters = listExpensesSchema.parse(input);
  const store = await getCurrentStore(userId);
  if (!store) {
    return { items: [], totalPaidInCents: 0, totalPendingInCents: 0 };
  }

  return withTenant(store.id, userId, async (tx) => {
    const conds = [eq(expenseTable.storeId, store.id)];
    if (filters.from) {
      // Filtra por data efetiva quando paga, senão data de vencimento.
      conds.push(
        sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate}) >= ${filters.from}`,
      );
    }
    if (filters.to) {
      conds.push(
        sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate}) <= ${filters.to}`,
      );
    }
    if (filters.category) {
      conds.push(eq(expenseTable.category, filters.category));
    }
    if (filters.paid === "paid") {
      conds.push(isNotNull(expenseTable.paidAt));
    } else if (filters.paid === "pending") {
      conds.push(isNull(expenseTable.paidAt));
    }

    const items = await tx
      .select({
        id: expenseTable.id,
        category: expenseTable.category,
        amountInCents: expenseTable.amountInCents,
        paidAt: expenseTable.paidAt,
        dueDate: expenseTable.dueDate,
        supplierId: expenseTable.supplierId,
        recurring: expenseTable.recurring,
        notes: expenseTable.notes,
        createdAt: expenseTable.createdAt,
      })
      .from(expenseTable)
      .where(and(...conds))
      .orderBy(desc(sql`coalesce(${expenseTable.paidAt}, ${expenseTable.dueDate})`))
      .limit(500);

    const [aggRow] = await tx
      .select({
        paid: sql<number>`coalesce(sum(${expenseTable.amountInCents}) filter (where ${expenseTable.paidAt} is not null), 0)::int`,
        pending: sql<number>`coalesce(sum(${expenseTable.amountInCents}) filter (where ${expenseTable.paidAt} is null), 0)::int`,
      })
      .from(expenseTable)
      .where(and(...conds));

    return {
      items,
      totalPaidInCents: aggRow?.paid ?? 0,
      totalPendingInCents: aggRow?.pending ?? 0,
    };
  });
}
