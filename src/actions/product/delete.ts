"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productImageTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
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

import { type DeleteProductInput,deleteProductSchema } from "./schema";

export type DeleteProductResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deleta produto. Hard delete (não há `deletedAt` no schema).
 *
 * Ordem (importante):
 *  1. Coleta URLs das imagens ANTES de deletar do DB.
 *  2. DELETE do produto. Cascade automático leva `product_image` e
 *     `product_variant`. Se o DB falhar, abortamos sem mexer no Storage.
 *  3. Remove do Storage as imagens coletadas no passo 1. Falha silenciosa
 *     (orfãos no bucket são cosméticos; ordem inversa quebraria FK).
 *
 * Lojista-friendly: confirmação dupla é responsabilidade da UI (AlertDialog).
 * Aqui assumimos que o caller já confirmou.
 */
export async function deleteProduct(
  input: DeleteProductInput,
): Promise<DeleteProductResult> {
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

  const parsed = deleteProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Identificador inválido." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // 1–2. Tudo de DB sob withTenant (RLS via GUC).
  type DeleteResult =
    | { ok: true; images: Array<{ url: string }> }
    | { ok: false; error: string };

  let result: DeleteResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const product = await tx.query.productTable.findFirst({
        where: and(
          eq(productTable.id, parsed.data.productId),
          eq(productTable.storeId, store.id),
        ),
        columns: { id: true },
      });
      if (!product) {
        return { ok: false, error: "Produto não encontrado." } as const;
      }

      const images = await tx
        .select({ url: productImageTable.url })
        .from(productImageTable)
        .where(eq(productImageTable.productId, parsed.data.productId));

      await tx
        .delete(productTable)
        .where(
          and(
            eq(productTable.id, parsed.data.productId),
            eq(productTable.storeId, store.id),
          ),
        );

      return { ok: true, images } as const;
    });
  } catch (e) {
    logger.error("product.delete_failed", {
      err: e,
      storeId: store.id,
      productId: parsed.data.productId,
    });
    return { ok: false, error: "Falha ao excluir o produto." };
  }

  if (!result.ok) return result;
  const images = result.images;

  // 3. Limpeza do Storage (best-effort, não falha a operação)
  await Promise.all(
    images.map(async ({ url }) => {
      const path = extractStoragePath("productImages", url);
      if (!path) {
        logger.warn("product.delete.url_outside_bucket", { url });
        return;
      }
      await deleteFromStorage({ bucket: "productImages", path });
    }),
  );

  // 4. Invalida caches
  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
