/**
 * Loader de produtos relacionados — usado no PDP ("Você pode gostar também").
 *
 * Estratégia:
 *  1. Busca produtos da MESMA categoria (excluindo o atual), ordem aleatória.
 *  2. Se vier menos que `limit`, completa com os mais recentes da loja
 *     (também excluindo o atual e os já trazidos).
 *  3. Anexa a primeira imagem usando `attachPrimaryImage`.
 *
 * Cache: invalidado via tag `store-${slug}` em qualquer mutação do
 * catálogo (consistência com demais loaders).
 */
import { and, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { productTable } from "@/db/schema";
import {
  attachPrimaryImage,
  type ProductCardData,
} from "@/lib/storefront/_shared";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

interface LoadRelatedParams {
  storeId: string;
  excludeProductId: string;
  categoryId: string | null;
  limit: number;
}

async function loadRelatedFromDb(
  params: LoadRelatedParams,
): Promise<ProductCardData[]> {
  const { storeId, excludeProductId, categoryId, limit } = params;

  return withTenant(storeId, null, async (tx) => {
    let related: (typeof productTable.$inferSelect)[] = [];

    // 1. Mesma categoria, ordem aleatória.
    if (categoryId) {
      related = await tx
        .select()
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, storeId),
            eq(productTable.categoryId, categoryId),
            eq(productTable.isActive, true),
            ne(productTable.id, excludeProductId),
          ),
        )
        .orderBy(sql`RANDOM()`)
        .limit(limit);
    }

    // 2. Fallback: mais recentes da loja, excluindo já trazidos.
    if (related.length < limit) {
      const alreadyIds = [excludeProductId, ...related.map((p) => p.id)];
      const fillCount = limit - related.length;
      const fallback = await tx
        .select()
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, storeId),
            eq(productTable.isActive, true),
            notInArray(productTable.id, alreadyIds),
          ),
        )
        .orderBy(desc(productTable.createdAt))
        .limit(fillCount);
      related = [...related, ...fallback];
    }

    return attachPrimaryImage(tx, storeId, related);
  });
}

/**
 * Carrega N produtos relacionados ao produto atual. `categoryId` opcional —
 * quando ausente, pula direto pro fallback de mais recentes.
 */
export const getRelatedProducts = cache(
  async (
    storeId: string,
    storeSlug: string,
    excludeProductId: string,
    categoryId: string | null,
    limit = 6,
  ): Promise<ProductCardData[]> => {
    const cached = unstable_cache(
      async () =>
        loadRelatedFromDb({ storeId, excludeProductId, categoryId, limit }),
      [
        "storefront-related",
        storeId,
        excludeProductId,
        categoryId ?? "none",
        String(limit),
      ],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 600 },
    );
    return cached();
  },
);
