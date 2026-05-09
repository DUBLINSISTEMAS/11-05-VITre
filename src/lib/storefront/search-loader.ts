/**
 * Busca pública de produtos por nome.
 *
 * MVP usa `ILIKE %q%` no nome (Postgres). Performance é OK até dezenas
 * de milhares de produtos por loja — bem além do realista pra o MVP.
 * Migrar pra full-text (`tsvector`) na Fase 2 se ficar lento.
 *
 * Cache:
 *  - Resultados cacheados por (storeId, q, page, limit) com TTL 60s.
 *    Termos comuns (nomes populares) tiram proveito; termos únicos
 *    pagam só 1 query.
 *  - Termos absurdamente longos (> MAX_CACHEABLE_LENGTH) pulam cache
 *    pra evitar pollution. Rate-limit do route handler protege flood.
 *  - Termos curtos (< MIN_QUERY_LENGTH) retornam vazio sem query.
 */
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { productTable } from "@/db/schema";
import {
  attachPrimaryImage,
  DEFAULT_PRODUCT_LIMIT,
  escapeIlikeTerm,
  type ListResult,
  MAX_PRODUCT_LIMIT,
} from "@/lib/storefront/_shared";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

const MIN_QUERY_LENGTH = 2;
const MAX_CACHEABLE_LENGTH = 50;

export interface SearchProductsParams {
  storeId: string;
  storeSlug: string;
  q: string;
  page?: number;
  limit?: number;
}

async function runSearch(
  storeId: string,
  q: string,
  page: number,
  limit: number,
): Promise<ListResult> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_PRODUCT_LIMIT);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  return withTenant(storeId, null, async (tx) => {
    // Se q está vazio, retorna todos os produtos ativos
    // Se q tem valor, filtra por nome com ILIKE
    const baseConditions = [
      eq(productTable.storeId, storeId),
      eq(productTable.isActive, true),
    ];
    
    const where = q.length > 0
      ? and(...baseConditions, ilike(productTable.name, escapeIlikeTerm(q)))
      : and(...baseConditions);

    const [rows, totalResult] = await Promise.all([
      tx
        .select()
        .from(productTable)
        .where(where)
        .orderBy(desc(productTable.createdAt))
        .limit(safeLimit)
        .offset(offset),
      tx.select({ value: count() }).from(productTable).where(where),
    ]);

    const items = await attachPrimaryImage(tx, storeId, rows);
    const total = totalResult[0]?.value ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / safeLimit));
    return { items, total, page: safePage, pageCount, limit: safeLimit };
  });
}

export const searchProducts = cache(
  async (params: SearchProductsParams): Promise<ListResult> => {
    const q = params.q.trim();
    const page = params.page ?? 1;
    const limit = params.limit ?? DEFAULT_PRODUCT_LIMIT;

    // Termos curtos (mas não vazios) retornam vazio
    if (q.length > 0 && q.length < MIN_QUERY_LENGTH) {
      return { items: [], total: 0, page: 1, pageCount: 1, limit };
    }

    // Termos absurdamente longos não vão pro cache pra não inchar storage.
    if (q.length > MAX_CACHEABLE_LENGTH) {
      return runSearch(params.storeId, q, page, limit);
    }

    const cacheKey = [
      "storefront-search",
      params.storeId,
      q.length > 0 ? q.toLowerCase() : "__all__",
      String(page),
      String(limit),
    ];

    const cached = unstable_cache(
      async () => runSearch(params.storeId, q, page, limit),
      cacheKey,
      { tags: [STORE_CACHE_TAG(params.storeSlug)], revalidate: 60 },
    );
    return cached();
  },
);
