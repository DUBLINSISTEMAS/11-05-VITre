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

import { deleteExpenseSchema } from "./schema";

export type DeleteExpenseResult = { ok: true } | { ok: false; error: string };

export async function deleteExpense(input: {
  id: string;
}): Promise<DeleteExpenseResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .delete(expenseTable)
        .where(
          and(
            eq(expenseTable.id, parsed.data.id),
            eq(expenseTable.storeId, store.id),
          ),
        );
    });

    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/relatorios/dre");
    return { ok: true };
  } catch (e) {
    logger.error("expense.delete_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao apagar despesa. Tente novamente."),
    };
  }
}
