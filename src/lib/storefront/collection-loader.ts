/**
 * Loader público de coleções customizáveis (ADR-0031, Frente C).
 *
 * Storefront é zero-login (ADR-0008). Coleção é uma "rota nomeada"
 * (`/colecao/[slug]`) com produtos curados pelo admin.
 *
 * Modelo (storefront-collection.ts):
 *   storefront_collection  — name, slug, description, isActive, showInHome
 *   storefront_collection_item — (collection_id, product_id, store_id, position)
 *
 * Visibilidade pública:
 *   - Coleção precisa `is_active = true`
 *   - Item precisa pertencer a produto `is_active = true` E
 *     `is_published_to_storefront = true` (ADR-0030 — separação
 *     Gestão × Loja Online).
 *
 * RLS:
 *   - SQL 39 instala `storefront_collection_tenant_isolation` FOR ALL.
 *   - Sem policy de leitura pública, então precisamos setar o GUC com
 *     `withTenant(storeId, null, ...)` — mesmo padrão de `categories-loader`.
 *
 * Cache:
 *   - `unstable_cache` com tag `store-${slug}` (convenção #4 do CLAUDE.md).
 *   - React `cache()` dedupa no mesmo request.
 *   - TTL 300s alinhado com outros loaders.
 */
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { productTable } from "@/db/schema";
import {
  storefrontCollectionItemTable,
  storefrontCollectionTable,
} from "@/db/schema/storefront-collection";
import {
  attachPrimaryImage,
  type ProductCardData,
} from "@/lib/storefront/_shared";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

export interface CollectionDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  items: ProductCardData[];
}

async function loadCollectionFromDb(
  storeId: string,
  collectionSlug: string,
): Promise<CollectionDetail | null> {
  return withTenant(storeId, null, async (tx) => {
    const collection = await tx.query.storefrontCollectionTable.findFirst({
      where: and(
        eq(storefrontCollectionTable.storeId, storeId),
        eq(storefrontCollectionTable.slug, collectionSlug),
        eq(storefrontCollectionTable.isActive, true),
      ),
    });
    if (!collection) return null;

    // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
    // Join collection_item → product filtrando por publicação pública.
    const rows = await tx
      .select({ product: productTable })
      .from(storefrontCollectionItemTable)
      .innerJoin(
        productTable,
        eq(productTable.id, storefrontCollectionItemTable.productId),
      )
      .where(
        and(
          eq(storefrontCollectionItemTable.collectionId, collection.id),
          eq(productTable.storeId, storeId),
          eq(productTable.isActive, true),
          eq(productTable.isPublishedToStorefront, true),
        ),
      )
      .orderBy(asc(storefrontCollectionItemTable.position));

    const products = rows.map((r) => r.product);
    const items = await attachPrimaryImage(tx, storeId, products);

    return {
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      description: collection.description,
      items,
    };
  });
}

/**
 * Resolve coleção pública por slug + itens. Retorna `null` quando coleção
 * não existe, está inativa ou pertence a outra loja — caller responde 404.
 *
 * Cached por (storeId, collectionSlug); invalidação via tag `store-${slug}`
 * (admin chama `revalidateTag` em todas as mutações de coleção).
 */
export const loadCollectionBySlug = cache(
  async (
    storeSlug: string,
    storeId: string,
    collectionSlug: string,
  ): Promise<CollectionDetail | null> => {
    const cached = unstable_cache(
      async () => loadCollectionFromDb(storeId, collectionSlug),
      ["storefront-collection", storeId, collectionSlug],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);
