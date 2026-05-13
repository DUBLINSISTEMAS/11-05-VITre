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
import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { productRelatedTable, productTable } from "@/db/schema";
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

    // 1. CURADORIA MANUAL — lojista escolheu N produtos relacionados
    //    no admin. Tem prioridade total: se há manual, NÃO complementa
    //    com auto-pick (lojista quer controle). Ordem = `position`.
    const manualRows = await tx
      .select({
        id: productRelatedTable.relatedProductId,
        position: productRelatedTable.position,
      })
      .from(productRelatedTable)
      .where(
        and(
          eq(productRelatedTable.storeId, storeId),
          eq(productRelatedTable.productId, excludeProductId),
        ),
      )
      .orderBy(asc(productRelatedTable.position))
      .limit(limit);

    if (manualRows.length > 0) {
      const manualIds = manualRows.map((r) => r.id);
      const manualProducts = await tx
        .select()
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, storeId),
            eq(productTable.isActive, true),
            inArray(productTable.id, manualIds),
          ),
        );
      // Mantém ordem do manualIds (banco não garante ordem por inArray).
      const byId = new Map(manualProducts.map((p) => [p.id, p]));
      related = manualIds
        .map((id) => byId.get(id))
        .filter((p): p is typeof productTable.$inferSelect => Boolean(p));
      return attachPrimaryImage(tx, storeId, related);
    }

    // 2. AUTO — mesma categoria, ordem aleatória.
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

    // 3. FALLBACK — mais recentes da loja, excluindo já trazidos.
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
