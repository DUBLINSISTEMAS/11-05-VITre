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

import { type DeleteCategoryInput,deleteCategorySchema } from "./schema";

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deleta categoria.
 *
 * Bloqueia se tem subcategorias filhas (Sandra deve mover/apagar antes).
 * Permite deletar mesmo com produtos associados — o FK é `set null`,
 * produtos ficam "Sem categoria" automaticamente.
 *
 * UI deve confirmar via AlertDialog antes de chamar.
 */
export async function deleteCategory(
  input: DeleteCategoryInput,
): Promise<DeleteCategoryResult> {
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

  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult = { ok: true } | { ok: false; error: string };
  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const cat = await tx.query.categoryTable.findFirst({
        where: and(
          eq(categoryTable.id, parsed.data.categoryId),
          eq(categoryTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!cat) {
        return { ok: false, error: "Categoria não encontrada." } as const;
      }

      const child = await tx.query.categoryTable.findFirst({
        where: and(
          eq(categoryTable.parentId, parsed.data.categoryId),
          eq(categoryTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (child) {
        return {
          ok: false,
          error:
            "Apague ou mova as subcategorias antes de excluir esta categoria.",
        } as const;
      }

      await tx
        .delete(categoryTable)
        .where(
          and(
            eq(categoryTable.id, parsed.data.categoryId),
            eq(categoryTable.storeId, store.id),
          ),
        );

      return { ok: true } as const;
    });
  } catch (e) {
    logger.error("category.delete_failed", {
      err: e,
      storeId: store.id,
      categoryId: parsed.data.categoryId,
    });
    return { ok: false, error: "Falha ao excluir categoria." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
