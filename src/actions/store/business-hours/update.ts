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

import {
  type UpdateBusinessHoursInput,
  updateBusinessHoursSchema,
} from "./schema";

export type UpdateBusinessHoursResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Persiste `store.business_hours` (ADR-0023). `hours=null` limpa o campo
 * (volta a "não configurado").
 */
export async function updateBusinessHours(
  input: UpdateBusinessHoursInput,
): Promise<UpdateBusinessHoursResult> {
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

  const parsed = updateBusinessHoursSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os horários informados.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          businessHours: data.hours,
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.update_business_hours_failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao salvar horários." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
