"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { categoryTable } from "@/db/schema";
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

import {
  type RemoveCategoryImageInput,
  removeCategoryImageSchema,
} from "./schema";

export type RemoveCategoryImageResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Remove imagem da categoria: zera coluna no DB + apaga do Storage
 * (best-effort).
 */
export async function removeCategoryImage(
  input: RemoveCategoryImageInput,
): Promise<RemoveCategoryImageResult> {
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

  const parsed = removeCategoryImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Categoria inválida." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const existing = await withTenant(store.id, userId, async (tx) =>
    tx.query.categoryTable.findFirst({
      where: and(
        eq(categoryTable.id, parsed.data.categoryId),
        eq(categoryTable.storeId, store.id),
      ),
      columns: { id: true, imageUrl: true },
    }),
  );
  if (!existing) {
    return { ok: false, error: "Categoria não encontrada." };
  }
  if (!existing.imageUrl) {
    return { ok: true };
  }

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(categoryTable)
        .set({ imageUrl: null })
        .where(
          and(
            eq(categoryTable.id, parsed.data.categoryId),
            eq(categoryTable.storeId, store.id),
          ),
        );
    });
  } catch (e) {
    console.error("[remove-category-image] db update falhou", e);
    return { ok: false, error: "Falha ao remover imagem." };
  }

  const oldPath = extractStoragePath("categoryImages", existing.imageUrl);
  if (oldPath) {
    await deleteFromStorage({ bucket: "categoryImages", path: oldPath });
  }

  revalidatePath("/admin/categorias");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
