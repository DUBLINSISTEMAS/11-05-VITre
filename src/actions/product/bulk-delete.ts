"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimitError, rateLimits } from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type BulkDeleteProductsInput,
  bulkDeleteProductsSchema,
} from "./schema";

export type BulkDeleteProductsResult =
  | { ok: true; archived: number }
  | { ok: false; error: string };

/**
 * Arquiva produtos em massa sem apagar linhas do banco.
 *
 * Onda 2 (2026-05-28): schema agora tem `archivedAt` (drizzle/0037).
 * Mesma semântica de delete.ts: archivedAt=now() + isActive/Published/
 * Featured=false. archivedAt é o sinal canônico que distingue arquivado
 * de pausado.
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

  let archived = 0;
  try {
    archived = await withTenant(store.id, userId, async (tx) => {
      const rows = await tx
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
            eq(productTable.storeId, store.id),
            inArray(productTable.id, productIds),
          ),
        )
        .returning({ id: productTable.id });

      return rows.length;
    });
  } catch (e) {
    logger.error("product.bulk_archive_failed", {
      err: e,
      storeId: store.id,
      count: productIds.length,
    });
    return { ok: false, error: "Falha ao arquivar produtos." };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  revalidateTag(`store-${store.slug}`);

  return { ok: true, archived };
}
