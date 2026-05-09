"use server";

import { and, eq, isNull } from "drizzle-orm";
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
import { withTenant } from "@/lib/tenant";

import {
  type ReorderCategoriesInput,
  reorderCategoriesSchema,
} from "./schema";

export type ReorderCategoriesResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Reordena categorias num escopo (raízes ou filhas de um parent).
 *
 * Defesa em profundidade: validamos que TODOS os IDs informados pertencem
 * à loja E ao escopo (mesmo `parentId`). Sem isso, o cliente poderia
 * "promover" uma filha pra raiz alterando posição.
 *
 * Para ~10 categorias, loop em transação é simples e suficiente.
 */
export async function reorderCategories(
  input: ReorderCategoriesInput,
): Promise<ReorderCategoriesResult> {
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

  const parsed = reorderCategoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const { orderedIds, parentId } = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  type StepResult = { ok: true } | { ok: false; error: string };
  let result: StepResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const scope = await tx.query.categoryTable.findMany({
        where: and(
          eq(categoryTable.storeId, store.id),
          parentId === null
            ? isNull(categoryTable.parentId)
            : eq(categoryTable.parentId, parentId),
        ),
        columns: { id: true },
      });
      const scopeIds = new Set(scope.map((c) => c.id));
      for (const id of orderedIds) {
        if (!scopeIds.has(id)) {
          return {
            ok: false,
            error: "Categoria fora do escopo informado.",
          } as const;
        }
      }

      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(categoryTable)
          .set({ position: i })
          .where(
            and(
              eq(categoryTable.id, orderedIds[i]!),
              eq(categoryTable.storeId, store.id),
            ),
          );
      }

      return { ok: true } as const;
    });
  } catch (e) {
    console.error("[reorder-categories] transaction falhou", e);
    return { ok: false, error: "Falha ao reordenar." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/categorias");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
