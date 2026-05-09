/**
 * Loader público de loja por slug.
 *
 * Storefront é zero-login (ADR-0008). Toda página pública resolve a loja
 * a partir do `[storeSlug]` da URL. Esse loader é a porta de entrada.
 *
 * Cache:
 *  - `unstable_cache` com tag `store-${slug}` → invalidado em mutações
 *    do admin (configurações, logo, cor) via `revalidateTag()`.
 *  - Cache duplo: React `cache()` dedupa no mesmo request (layout + page +
 *    metadata) e `unstable_cache` persiste entre requests.
 *
 * RLS:
 *  - Resolver slug→storeId é o caso documentado em `withServiceRole`
 *    (tenant.ts). Antes de saber o tenant não dá pra setar GUC.
 *  - Filtramos `is_active = true` no app-layer também (defesa em
 *    profundidade — RLS já tem policy idêntica).
 */
import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Store } from "@/db/schema";
import { storeTable } from "@/db/schema";
import { withServiceRole } from "@/lib/tenant";

export const STORE_CACHE_TAG = (slug: string) => `store-${slug}`;

async function loadStoreFromDb(slug: string): Promise<Store | null> {
  return withServiceRole(`storefront: resolve slug=${slug}`, async (tx) => {
    const store = await tx.query.storeTable.findFirst({
      where: and(eq(storeTable.slug, slug), eq(storeTable.isActive, true)),
    });
    return store ?? null;
  });
}

/**
 * Resolve loja pública por slug. Retorna `null` quando slug não existe
 * ou loja está inativa — caller deve responder 404.
 *
 * Use em: layout, page, generateMetadata, sitemap.
 */
export const getStoreBySlug = cache(async (slug: string): Promise<Store | null> => {
  const cached = unstable_cache(
    async () => loadStoreFromDb(slug),
    ["storefront-store-by-slug", slug],
    { tags: [STORE_CACHE_TAG(slug)], revalidate: 300 },
  );
  return cached();
});
