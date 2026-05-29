"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimitError, rateLimits } from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { type DeleteProductInput, deleteProductSchema } from "./schema";

export type DeleteProductResult = { ok: true } | { ok: false; error: string };

/**
 * Arquiva produto sem destruir histórico.
 *
 * Onda 2 (2026-05-28): schema agora tem `archivedAt` (drizzle/0037).
 * Arquivar significa: archivedAt=now() + isActive=false +
 * isPublishedToStorefront=false + isFeatured=false. Compat completa com
 * código antigo (queries que filtram isActive=true continuam funcionando).
 * archivedAt é o sinal CANÔNICO pra futuras telas "Arquivados" diferenciarem
 * "pausado pelo lojista" de "tirado de circulação".
 *
 * Imagens, variantes, movimentações e vendas antigas ficam preservadas para
 * relatório, auditoria e migração para o Supabase limpo.
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

  type ArchiveResult = { ok: true } | { ok: false; error: string };

  let result: ArchiveResult;
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

      await tx
        .update(productTable)
        .set({
          archivedAt: new Date(),
          isActive: false,
          isPublishedToStorefront: false,
          isFeatured: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productTable.id, parsed.data.productId),
            eq(productTable.storeId, store.id),
          ),
        );

      return { ok: true } as const;
    });
  } catch (e) {
    logger.error("product.archive_failed", {
      err: e,
      storeId: store.id,
      productId: parsed.data.productId,
    });
    return { ok: false, error: "Falha ao arquivar o produto." };
  }

  if (!result.ok) return result;

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  revalidateTag(`store-${store.slug}`);

  return { ok: true };
}
