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

import { type UpdateAppearanceInput, updateAppearanceSchema } from "./schema";

export type UpdateAppearanceResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Atualiza cor primária + rotação do banner. Onda 3 (2026-05-12):
 * extraído de updateStore quando movemos esses campos pra /admin/aparencia.
 * Logo/ícone já têm upload próprio (StoreImageUploader).
 */
export async function updateAppearance(
  input: UpdateAppearanceInput,
): Promise<UpdateAppearanceResult> {
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

  const parsed = updateAppearanceSchema.safeParse(input);
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

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          primaryColor: data.primaryColor,
          bannerRotationSec: data.bannerRotationSec,
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.update_appearance_failed", { err: e, storeId: store.id });
    return { ok: false, error: "Falha ao salvar aparência." };
  }

  revalidatePath("/admin/aparencia");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
