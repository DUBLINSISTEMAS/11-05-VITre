"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type UpdatePaymentInput, updatePaymentSchema } from "./schema";

export type UpdatePaymentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza apenas o bloco de pagamento da loja (Fase 2 — ADR-0013).
 *
 * Separado de `updateStore` (que toca identidade/contato/endereço/insta)
 * pra evitar:
 *   1. Save acidental de campo não-editado quando lojista mexe só em 1
 *      seção e a outra está stale por aba aberta há horas (concurrent
 *      edit safety).
 *   2. Acoplamento de UI — rota dedicada `/admin/pagamento` persiste seu
 *      próprio domínio sem precisar carregar/serializar o resto.
 *
 * `paymentMethodsNote` "" → null pra consistência com schema nullable.
 */
export async function updatePayment(
  input: UpdatePaymentInput,
): Promise<UpdatePaymentResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const emptyToNull = (s: string | null): string | null => {
    if (s === null) return null;
    const trimmed = s.trim();
    return trimmed === "" ? null : trimmed;
  };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          acceptsCard: data.acceptsCard,
          cardMaxInstallments: data.cardMaxInstallments,
          installmentBasePrice: data.installmentBasePrice,
          showInstallmentsOnPDP: data.showInstallmentsOnPDP,
          cashDiscountBps: data.cashDiscountBps,
          // Sprint 3 (2026-05-26) — juros do cartão de crédito no PDV.
          cardInterestRateBps: data.cardInterestRateBps,
          cardInterestFreeUpTo: data.cardInterestFreeUpTo,
          paymentMethodsNote: emptyToNull(data.paymentMethodsNote),
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.update_payment_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao salvar configurações de pagamento." };
  }

  revalidatePath("/admin/pagamento");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
