/**
 * Loader consolidado da home da loja.
 *
 * Antes: page.tsx disparava 4 queries via Promise.all
 * (banners + categorias + featured + recent), cada uma com seu próprio
 * `withTenant` = 4 transações Drizzle. Pool max=3 vira fila quando
 * múltiplas lojas/visitantes renderizam home ao mesmo tempo.
 *
 * Agora: 1 transação única dentro de `withTenant`. Os 4 SELECTs rodam
 * em SÉRIE (`pg` deprecou paralelas no mesmo client) mas sob a mesma
 * conexão — overhead drástico menor.
 *
 * Cache: `unstable_cache` por (storeId), tag `store-${slug}`, TTL 5min.
 * Quando o lojista publica produto/banner/categoria, `revalidateTag`
 * invalida tudo da home de uma vez (já era o comportamento antes).
 *
 * Os loaders individuais continuam exportados em seus arquivos pra uso
 * em OUTRAS páginas (categoria, destaques, PDP). Apenas a home consome
 * este consolidado.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Banner, Category } from "@/db/schema";
import {
  bannerTable,
  categoryTable,
  productTable,
} from "@/db/schema";
import {
  attachPrimaryImage,
  type ProductCardData,
} from "@/lib/storefront/_shared";
import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

export interface HomePageData {
  banners: Banner[];
  categoryTree: CategoryNode[];
  featured: ProductCardData[];
  recent: ProductCardData[];
}

async function loadHomePageDataFromDb(storeId: string): Promise<HomePageData> {
  return withTenant(storeId, null, async (tx) => {
    // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
    // Index hits em (storeId, isActive) + (storeId, position) cobrem
    // todos os 4 SELECTs; latency cumulativa < 50ms em datasets MVP.

    const banners = await tx
      .select()
      .from(bannerTable)
      .where(
        and(eq(bannerTable.storeId, storeId), eq(bannerTable.isActive, true)),
      )
      .orderBy(asc(bannerTable.position), asc(bannerTable.createdAt));

    const categoryRows = await tx.query.categoryTable.findMany({
      where: and(
        eq(categoryTable.storeId, storeId),
        eq(categoryTable.isActive, true),
      ),
      orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
    });

    const featuredRows = await tx
      .select()
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, storeId),
          eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
          eq(productTable.isFeatured, true),
        ),
      )
      .orderBy(desc(productTable.createdAt))
      .limit(8);

    const recentRows = await tx
      .select()
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, storeId),
          eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
        ),
      )
      .orderBy(desc(productTable.createdAt))
      .limit(8);

    // Tree 2 níveis em memória (mesma lógica de categories-loader).
    const byParent = new Map<string, Category[]>();
    const roots: Category[] = [];
    for (const c of categoryRows) {
      if (c.parentId === null) {
        roots.push(c);
      } else {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      }
    }
    const categoryTree: CategoryNode[] = roots.map((r) => ({
      ...r,
      children: byParent.get(r.id) ?? [],
    }));

    // Anexa imagem primária aos produtos (1 query agregada cada).
    const featured = await attachPrimaryImage(tx, storeId, featuredRows);
    const recent = await attachPrimaryImage(tx, storeId, recentRows);

    return { banners, categoryTree, featured, recent };
  });
}

/**
 * Consolida banners + categorias + featured + recent para a home da loja.
 * Cacheado por storeId; invalidação via `revalidateTag(store-${slug})`.
 */
export const getHomePageData = cache(
  async (storeId: string, storeSlug: string): Promise<HomePageData> => {
    const cached = unstable_cache(
      async () => loadHomePageDataFromDb(storeId),
      ["storefront-home", storeId],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);
