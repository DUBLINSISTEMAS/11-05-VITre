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

import {
  categoryTable,
  productTable,
  storeTable,
} from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildStorefrontUrl } from "@/lib/storefront/canonical-url";
import { withServiceRole } from "@/lib/tenant";

export const revalidate = 3600; // 1h

/**
 * Em build-time Vercel chama esta função pra emitir `sitemap.xml`. Se o
 * Supabase oscilar (cold start, rate-limit transitório), o build inteiro
 * quebrava. Agora retornamos um sitemap mínimo com as rotas estáticas
 * — Googlebot consegue rastrear o resto via links internos, e a próxima
 * revalidação (1h) tenta de novo. Falha SEO momentânea > deploy travado.
 */
function buildStaticSitemap(baseUrl: string): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/termos`, priority: 0.3 },
    { url: `${baseUrl}/privacidade`, priority: 0.3 },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  try {
    return await loadFullSitemap(baseUrl);
  } catch (err) {
    logger.error("sitemap.db_fetch_failed", { err });
    return buildStaticSitemap(baseUrl);
  }
}

async function loadFullSitemap(
  baseUrl: string,
): Promise<MetadataRoute.Sitemap> {
  // CRÍTICO: usa `tx` (não `db`). `db` é o pool RLS-bound (vitre_app); sem
  // GUC `app.current_store_id` setado e com FORCE RLS ativo, queries cross-
  // tenant retornam zero. `withServiceRole` entrega o `tx` com a role
  // postgres (BYPASSRLS) — é justamente o helper que cobre este caso.
  return withServiceRole("sitemap: list active stores+products+categories", async (tx) => {
    const stores = await tx
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
    // SÉRIE dentro do mesmo tx — `pg` deprecou queries paralelas no
    // mesmo client. Cada SELECT com index é rápido; 2 round-trips OK.
    const products = await tx
      .select({
        slug: productTable.slug,
        storeId: productTable.storeId,
        updatedAt: productTable.updatedAt,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
          inArray(productTable.storeId, storeIds),
        ),
      );
    const categories = await tx
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
      );

    const slugByStoreId = new Map(stores.map((s) => [s.id, s.slug]));

    const entries: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    ];

    // Onda 34 (Bloco 5b): URLs do storefront via helper canônico —
    // respeitam STOREFRONT_CANONICAL_HOST_STYLE (path|subdomain).
    for (const store of stores) {
      entries.push(
        {
          url: buildStorefrontUrl(store.slug, ""),
          lastModified: store.updatedAt,
          priority: 0.9,
        },
        {
          url: buildStorefrontUrl(store.slug, "/sobre"),
          lastModified: store.updatedAt,
          priority: 0.5,
        },
        {
          url: buildStorefrontUrl(store.slug, "/buscar"),
          lastModified: store.updatedAt,
          priority: 0.4,
        },
      );
    }

    for (const cat of categories) {
      const slug = slugByStoreId.get(cat.storeId);
      if (!slug) continue;
      entries.push({
        url: buildStorefrontUrl(slug, `/categoria/${cat.slug}`),
        priority: 0.7,
      });
    }

    for (const product of products) {
      const slug = slugByStoreId.get(product.storeId);
      if (!slug) continue;
      entries.push({
        url: buildStorefrontUrl(slug, `/produto/${product.slug}`),
        lastModified: product.updatedAt,
        priority: 0.6,
      });
    }

    return entries;
  });
}
