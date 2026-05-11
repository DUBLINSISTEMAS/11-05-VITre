"use server";

import { and, eq, inArray } from "drizzle-orm";
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

import {
  type BulkDeleteProductsInput,
  bulkDeleteProductsSchema,
} from "./schema";

export type BulkDeleteProductsResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/**
 * Hard-delete N produtos em uma transação. Mesma estratégia do delete único:
 *  1. Coleta URLs de imagens dos produtos selecionados.
 *  2. DELETE produtos. Cascade leva product_image + product_variant.
 *  3. Remove imagens do Storage (best-effort).
 *
 * Idempotência: se o lojista clicar duplo no botão, segunda chamada deleta
 * 0 produtos (já não existem) e retorna ok com `deleted=0`.
 */
export async function bulkDeleteProducts(
  input: BulkDeleteProductsInput,
): Promise<BulkDeleteProductsResult> {
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

  const parsed = bulkDeleteProductsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const { productIds } = parsed.data;

  type DeleteResult = { deleted: number; images: Array<{ url: string }> };

  let result: DeleteResult;
  try {
    result = await withTenant(store.id, userId, async (tx) => {
      const images = await tx
        .select({ url: productImageTable.url })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, store.id),
            inArray(productImageTable.productId, productIds),
          ),
        );

      const deleted = await tx
        .delete(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            inArray(productTable.id, productIds),
          ),
        )
        .returning({ id: productTable.id });

      return { deleted: deleted.length, images };
    });
  } catch (e) {
    logger.error("product.bulk_delete_failed", {
      err: e,
      storeId: store.id,
      count: productIds.length,
    });
    return { ok: false, error: "Falha ao excluir produtos." };
  }

  // Storage cleanup (best-effort)
  await Promise.all(
    result.images.map(async ({ url }) => {
      const path = extractStoragePath("productImages", url);
      if (!path) return;
      await deleteFromStorage({ bucket: "productImages", path });
    }),
  );

  revalidatePath("/admin/produtos");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, deleted: result.deleted };
}
