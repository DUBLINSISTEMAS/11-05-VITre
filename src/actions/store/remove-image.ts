"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import {
  deleteFromStorage,
  extractStoragePath,
} from "@/lib/supabase/storage";
import { withTenant } from "@/lib/tenant";

import { removeStoreImageSchema } from "./schema";

export type RemoveStoreImageResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Remove logo OU ícone da loja: zera coluna no DB + apaga do Storage.
 * Storage é best-effort (warn no console).
 */
export async function removeStoreImage(input: {
  kind: "logo" | "icon";
}): Promise<RemoveStoreImageResult> {
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

  const parsed = removeStoreImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Tipo de imagem inválido." };
  }
  const { kind } = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const previousUrl = kind === "logo" ? store.logoUrl : store.iconUrl;
  if (!previousUrl) {
    return { ok: true };
  }

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({
          ...(kind === "logo" ? { logoUrl: null } : { iconUrl: null }),
          updatedAt: new Date(),
        })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    console.error("[remove-store-image] db update falhou", e);
    return { ok: false, error: "Falha ao remover imagem." };
  }

  const oldPath = extractStoragePath("storeLogos", previousUrl);
  if (oldPath) {
    await deleteFromStorage({ bucket: "storeLogos", path: oldPath });
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
