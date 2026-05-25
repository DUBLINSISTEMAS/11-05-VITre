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
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Banner, Category } from "@/db/schema";
import {
  bannerTable,
  categoryTable,
  productImageTable,
  productTable,
  storefrontCollectionItemTable,
  storefrontCollectionTable,
} from "@/db/schema";
import {
  attachPrimaryImage,
  type ProductCardData,
} from "@/lib/storefront/_shared";
import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

/** Sprint 5.3 — coleção visível na home como seção "Vitrines". */
export interface HomeCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** PP5 (2026-05-25) — kicker curto opcional ("Top semana", "Promo"). */
  kicker: string | null;
  /** PP5 — cor de fundo hex do card colorido (null = fallback neutro). */
  bgColor: string | null;
  productCount: number;
  /** Thumbnail = imagem primária do produto na 1ª posição da coleção. */
  thumbnailUrl: string | null;
}

export interface HomePageData {
  banners: Banner[];
  categoryTree: CategoryNode[];
  collections: HomeCollection[];
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

    // Sprint 5.3 — coleções com show_in_home=true, ordenadas por position.
    // Trazemos count de items + thumbnail do produto na 1ª posição numa
    // única query agregada pra não pagar N+1.
    const collectionRows = await tx
      .select({
        id: storefrontCollectionTable.id,
        slug: storefrontCollectionTable.slug,
        name: storefrontCollectionTable.name,
        description: storefrontCollectionTable.description,
        kicker: storefrontCollectionTable.kicker,
        bgColor: storefrontCollectionTable.bgColor,
        position: storefrontCollectionTable.position,
      })
      .from(storefrontCollectionTable)
      .where(
        and(
          eq(storefrontCollectionTable.storeId, storeId),
          eq(storefrontCollectionTable.isActive, true),
          eq(storefrontCollectionTable.showInHome, true),
        ),
      )
      .orderBy(
        asc(storefrontCollectionTable.position),
        asc(storefrontCollectionTable.name),
      )
      .limit(8);

    // Pra cada coleção: count de items + productId do 1º item (position 0).
    const collectionIds = collectionRows.map((c) => c.id);
    const countByCollection = new Map<string, number>();
    const firstProductByCollection = new Map<string, string>();
    if (collectionIds.length > 0) {
      const itemAgg = await tx
        .select({
          collectionId: storefrontCollectionItemTable.collectionId,
          total: sql<number>`count(*)::int`,
        })
        .from(storefrontCollectionItemTable)
        .where(
          and(
            eq(storefrontCollectionItemTable.storeId, storeId),
            inArray(
              storefrontCollectionItemTable.collectionId,
              collectionIds,
            ),
          ),
        )
        .groupBy(storefrontCollectionItemTable.collectionId);
      for (const a of itemAgg) {
        countByCollection.set(a.collectionId, a.total);
      }

      // 1º produto por coleção (menor position, fallback createdAt).
      const firstItems = await tx
        .select({
          collectionId: storefrontCollectionItemTable.collectionId,
          productId: storefrontCollectionItemTable.productId,
          position: storefrontCollectionItemTable.position,
          createdAt: storefrontCollectionItemTable.createdAt,
        })
        .from(storefrontCollectionItemTable)
        .where(
          and(
            eq(storefrontCollectionItemTable.storeId, storeId),
            inArray(
              storefrontCollectionItemTable.collectionId,
              collectionIds,
            ),
          ),
        )
        .orderBy(
          asc(storefrontCollectionItemTable.position),
          asc(storefrontCollectionItemTable.createdAt),
        );
      // Pega o 1º (menor position) por coleção.
      for (const r of firstItems) {
        if (!firstProductByCollection.has(r.collectionId)) {
          firstProductByCollection.set(r.collectionId, r.productId);
        }
      }
    }

    // Thumbnail = imagem primária do 1º produto. 1 SELECT agregado.
    const thumbnailByProduct = new Map<string, string>();
    const thumbnailProductIds = Array.from(firstProductByCollection.values());
    if (thumbnailProductIds.length > 0) {
      const imageRows = await tx
        .select({
          productId: productImageTable.productId,
          url: productImageTable.url,
          position: productImageTable.position,
        })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, storeId),
            inArray(productImageTable.productId, thumbnailProductIds),
          ),
        )
        .orderBy(asc(productImageTable.position));
      for (const img of imageRows) {
        if (!thumbnailByProduct.has(img.productId)) {
          thumbnailByProduct.set(img.productId, img.url);
        }
      }
    }

    const collections: HomeCollection[] = collectionRows
      .map((c) => {
        const firstProductId = firstProductByCollection.get(c.id);
        const thumbnailUrl =
          firstProductId !== undefined
            ? thumbnailByProduct.get(firstProductId) ?? null
            : null;
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          kicker: c.kicker,
          bgColor: c.bgColor,
          productCount: countByCollection.get(c.id) ?? 0,
          thumbnailUrl,
        };
      })
      // Esconde coleção vazia da home — link sem produto polui mais que ajuda.
      .filter((c) => c.productCount > 0);

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

    return { banners, categoryTree, collections, featured, recent };
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
