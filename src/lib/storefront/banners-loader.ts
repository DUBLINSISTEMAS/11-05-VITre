/**
 * Loader público de banners da home da loja.
 *
 * Banners são editados em `/admin/banners` (max 10/loja). No storefront,
 * mostramos apenas os ativos, ordenados por position.
 */
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Banner } from "@/db/schema";
import { bannerTable } from "@/db/schema";

/**
 * Alias semântico — banners ativos retornados ao storefront.
 * Hoje `Banner` direto, mas mantemos o alias caso o storefront precise
 * de uma projeção (joins, derivados editorial) sem afetar o tipo no admin.
 */
export type ActiveBanner = Banner;
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

async function loadBannersFromDb(storeId: string): Promise<Banner[]> {
  return withTenant(storeId, null, async (tx) => {
    return tx
      .select()
      .from(bannerTable)
      .where(
        and(eq(bannerTable.storeId, storeId), eq(bannerTable.isActive, true)),
      )
      .orderBy(asc(bannerTable.position), asc(bannerTable.createdAt));
  });
}

/**
 * Lista de banners ativos de uma loja, ordenados.
 */
export const getActiveBanners = cache(
  async (storeId: string, storeSlug: string): Promise<Banner[]> => {
    const cached = unstable_cache(
      async () => loadBannersFromDb(storeId),
      ["storefront-banners", storeId],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);
