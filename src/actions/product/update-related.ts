"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { productRelatedTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_RELATED = 12;

const updateRelatedSchema = z.object({
  productId: z.uuid(),
  relatedIds: z
    .array(z.uuid())
    .max(MAX_RELATED, `Máximo ${MAX_RELATED} produtos relacionados.`),
});

export type UpdateRelatedInput = z.input<typeof updateRelatedSchema>;
export type UpdateRelatedResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Substitui completamente a curadoria manual de "Você pode gostar também"
 * pra um produto. Estratégia DELETE-ALL + INSERT N — N tipicamente é
 * pequeno (≤12), simples e atômico dentro de withTenant.
 *
 * Valida:
 *  - Lojista logado + loja vinculada.
 *  - Produto-base existe e pertence à loja.
 *  - Cada relatedId existe, é ativo, pertence à mesma loja, NÃO é o
 *    próprio produto.
 *  - Sem duplicatas (Set).
 *  - Limite MAX_RELATED.
 */
export async function updateProductRelated(
  input: UpdateRelatedInput,
): Promise<UpdateRelatedResult> {
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

  const parsed = updateRelatedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Entrada inválida." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const dedupedIds = Array.from(new Set(parsed.data.relatedIds)).filter(
    (id) => id !== parsed.data.productId,
  );

  try {
    await withTenant(store.id, userId, async (tx) => {
      // Confirma produto-base existe na loja.
      const base = await tx.query.productTable.findFirst({
        where: and(
          eq(productTable.id, parsed.data.productId),
          eq(productTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!base) throw new Error("PRODUCT_NOT_FOUND");

      // Confirma todos relatedIds existem na MESMA loja e estão ativos.
      // Lojista não pode linkar produto de outra loja nem rascunho.
      let validIds: string[] = [];
      if (dedupedIds.length > 0) {
        const valid = await tx
          .select({ id: productTable.id })
          .from(productTable)
          .where(
            and(
              eq(productTable.storeId, store.id),
              eq(productTable.isActive, true),
              ne(productTable.id, parsed.data.productId),
              inArray(productTable.id, dedupedIds),
            ),
          );
        validIds = valid.map((v) => v.id);
      }

      // Replace-all atomicamente: apaga antigos + insere novos.
      await tx
        .delete(productRelatedTable)
        .where(
          and(
            eq(productRelatedTable.storeId, store.id),
            eq(productRelatedTable.productId, parsed.data.productId),
          ),
        );

      if (validIds.length > 0) {
        // Preserva ordem de seleção do lojista via `position`.
        // Reordenar segundo `dedupedIds` (input) e filtra pelos válidos.
        const orderedValid = dedupedIds.filter((id) => validIds.includes(id));
        await tx.insert(productRelatedTable).values(
          orderedValid.map((relatedId, idx) => ({
            storeId: store.id,
            productId: parsed.data.productId,
            relatedProductId: relatedId,
            position: idx,
          })),
        );
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "PRODUCT_NOT_FOUND") {
      return { ok: false, error: "Produto não encontrado." };
    }
    logger.error("product.update_related.failed", {
      err: e,
      storeId: store.id,
      productId: parsed.data.productId,
    });
    return { ok: false, error: "Falha ao salvar produtos relacionados." };
  }

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${parsed.data.productId}`);
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
