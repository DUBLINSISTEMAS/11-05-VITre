"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { expenseTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { safeUserMessage } from "@/lib/safe-error";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type CreateExpenseInput,createExpenseSchema } from "./schema";

export type CreateExpenseResult =
  | { ok: true; expenseId: string | string[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Cria 1 expense, OU 12 entries se `recurring: true` (mês a mês a partir
 * da data informada). Cada entry recebe `recurring=true` pra UI marcar.
 */
export async function createExpense(
  input: CreateExpenseInput,
): Promise<CreateExpenseResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    return await withTenant(store.id, userId, async (tx) => {
      // Recurring monthly: gera 12 entries com paidAt/dueDate +1mo cada vez.
      // App-layer porque relatório fica mais simples (não precisa expandir
      // "recurring" em runtime — cada entry é uma linha independente no DRE).
      const entries: typeof expenseTable.$inferInsert[] = [];

      if (data.recurring && (data.paidAt || data.dueDate)) {
        const baseDate = new Date(data.paidAt ?? data.dueDate!);
        for (let i = 0; i < 12; i += 1) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          const iso = d.toISOString().slice(0, 10);
          entries.push({
            storeId: store.id,
            createdBy: userId,
            category: data.category,
            amountInCents: data.amountInCents,
            paidAt: data.paidAt ? iso : null,
            dueDate: data.dueDate ? iso : null,
            supplierId: data.supplierId,
            recurring: true,
            notes: data.notes,
          });
        }
      } else {
        entries.push({
          storeId: store.id,
          createdBy: userId,
          category: data.category,
          amountInCents: data.amountInCents,
          paidAt: data.paidAt,
          dueDate: data.dueDate,
          supplierId: data.supplierId,
          recurring: false,
          notes: data.notes,
        });
      }

      const inserted = await tx
        .insert(expenseTable)
        .values(entries)
        .returning({ id: expenseTable.id });

      revalidatePath("/admin/financeiro/pagar");
      revalidatePath("/admin/relatorios/dre");

      return {
        ok: true,
        expenseId:
          inserted.length === 1 ? inserted[0]!.id : inserted.map((r) => r.id),
      };
    });
  } catch (e) {
    logger.error("expense.create_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(
        e,
        "Falha ao registrar despesa. Tente novamente.",
      ),
    };
  }
}
