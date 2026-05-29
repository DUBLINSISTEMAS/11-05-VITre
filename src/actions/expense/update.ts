"use server";

import { and, eq } from "drizzle-orm";
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

import { type UpdateExpenseInput,updateExpenseSchema } from "./schema";

export type UpdateExpenseResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateExpense(
  input: UpdateExpenseInput,
): Promise<UpdateExpenseResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = updateExpenseSchema.safeParse(input);
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
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(expenseTable)
        .set({
          category: data.category,
          amountInCents: data.amountInCents,
          paidAt: data.paidAt,
          dueDate: data.dueDate,
          supplierId: data.supplierId,
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseTable.id, data.id),
            eq(expenseTable.storeId, store.id),
          ),
        );
    });

    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/relatorios/dre");
    return { ok: true };
  } catch (e) {
    logger.error("expense.update_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao atualizar despesa. Tente novamente."),
    };
  }
}
