/**
 * Sitemap global.
 *
 * MVP: itera todas as lojas ATIVAS e gera URLs pra home/sobre/categorias/
 * produtos. Acima de ~50k URLs, migrar pra `sitemap-index` com sitemaps
 * por loja em `src/app/(storefront)/[storeSlug]/sitemap.ts`.
 *
 * Roda em request-time (sem cache forçado) — Next decide cache via
 * route segment config. Em produção, considerar `revalidate = 3600`
 * pra reduzir hits do crawler.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { db } from "@/db";
import {
  categoryTable,
  productTable,
  storeTable,
} from "@/db/schema";
import { env } from "@/lib/env";
import { withServiceRole } from "@/lib/tenant";

export const revalidate = 3600; // 1h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return withServiceRole("sitemap: list active stores+products+categories", async () => {
    const stores = await db
      .select({
        id: storeTable.id,
        slug: storeTable.slug,
        updatedAt: storeTable.updatedAt,
      })
      .from(storeTable)
      .where(eq(storeTable.isActive, true));

    if (stores.length === 0) {
      return [{ url: baseUrl, lastModified: new Date(), priority: 1.0 }];
    }

    const storeIds = stores.map((s) => s.id);

    // Filtra produtos/categorias por lojas ativas no DB — não trazer
    // dados de loja desativada e descartar em memória.
    const [products, categories] = await Promise.all([
      db
        .select({
          slug: productTable.slug,
          storeId: productTable.storeId,
          updatedAt: productTable.updatedAt,
        })
        .from(productTable)
        .where(
          and(
            eq(productTable.isActive, true),
            inArray(productTable.storeId, storeIds),
          ),
        ),
      db
        .select({
          slug: categoryTable.slug,
          storeId: categoryTable.storeId,
        })
        .from(categoryTable)
        .where(
          and(
            eq(categoryTable.isActive, true),
            inArray(categoryTable.storeId, storeIds),
          ),
        ),
    ]);

    const slugByStoreId = new Map(stores.map((s) => [s.id, s.slug]));

    const entries: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    ];

    for (const store of stores) {
      const storeUrl = `${baseUrl}/${store.slug}`;
      entries.push(
        { url: storeUrl, lastModified: store.updatedAt, priority: 0.9 },
        { url: `${storeUrl}/sobre`, lastModified: store.updatedAt, priority: 0.5 },
        { url: `${storeUrl}/buscar`, lastModified: store.updatedAt, priority: 0.4 },
      );
    }

    for (const cat of categories) {
      const slug = slugByStoreId.get(cat.storeId);
      if (!slug) continue;
      entries.push({
        url: `${baseUrl}/${slug}/categoria/${cat.slug}`,
        priority: 0.7,
      });
    }

    for (const product of products) {
      const slug = slugByStoreId.get(product.storeId);
      if (!slug) continue;
      entries.push({
        url: `${baseUrl}/${slug}/produto/${product.slug}`,
        lastModified: product.updatedAt,
        priority: 0.6,
      });
    }

    return entries;
  });
}
