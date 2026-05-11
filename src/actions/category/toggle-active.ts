"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { categoryTable } from "@/db/schema";
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
  type ToggleCategoryActiveInput,
  toggleCategoryActiveSchema,
} from "./schema";

export type ToggleCategoryActiveResult =
  | { ok: true; isActive: boolean }
  | { ok: false; error: string };

export async function toggleCategoryActive(
  input: ToggleCategoryActiveInput,
): Promise<ToggleCategoryActiveResult> {
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

  const parsed = toggleCategoryActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const row = await withTenant(store.id, userId, async (tx) => {
      const [r] = await tx
        .update(categoryTable)
        .set({ isActive: parsed.data.isActive })
        .where(
          and(
            eq(categoryTable.id, parsed.data.categoryId),
            eq(categoryTable.storeId, store.id),
          ),
        )
        .returning({ isActive: categoryTable.isActive });
      return r;
    });

    if (!row) {
      return { ok: false, error: "Categoria não encontrada." };
    }

    revalidatePath("/admin/categorias");
    revalidateTag(`store-${store.slug}`);

    return { ok: true, isActive: row.isActive };
  } catch (e) {
    logger.error("category.toggle_active_failed", {
      err: e,
      categoryId: parsed.data.categoryId,
    });
    return { ok: false, error: "Falha ao atualizar categoria." };
  }
}
