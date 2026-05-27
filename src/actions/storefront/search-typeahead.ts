"use server";

/**
 * searchTypeahead — Onda 6 (2026-05-27).
 *
 * Busca instantânea pra dropdown do input de `/buscar`. Chamada pelo
 * componente client `<SearchTypeahead>` a cada tecla (com debounce 200ms).
 *
 * Decisões:
 *  - **6 resultados** no payload. Typeahead enxuto não compete com
 *    a listagem cheia da página (que entra no Enter/submit). Retorna
 *    `total` separado pra renderizar "Ver todos os N resultados".
 *  - **Min 2 chars** alinhado com `MIN_QUERY_LENGTH` do search-loader.
 *    Termos curtos retornam vazio sem query (evita "a" derrubar cache).
 *  - **Rate limit `publicApi`** (60 req/min por IP). Usuário típico
 *    digita ~20 chars com debounce 200ms → 4-6 reqs por busca, muito
 *    abaixo do teto. Bot que faz scraping bate no limite rápido.
 *  - **Cache 60s** via `unstable_cache` com tag `STORE_CACHE_TAG`.
 *    Termo popular ("anel") em loja de joia é cache hit constante;
 *    revalidação automática quando produto muda (mesmo tag do search-loader).
 *  - **storeSlug → storeId server-side** evita o cliente forjar storeId.
 *    Custo: 1 cache lookup via `getStoreBySlug` que já está cached.
 *  - **Retorna apenas o que o dropdown renderiza**: id, name, slug,
 *    priceInCents (efetivo), thumbUrl. Sem stockQuantity / promoEndsAt /
 *    etc — typeahead não precisa, e payload menor = mais rápido.
 */
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";

import { productTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import { getEffectivePrice } from "@/lib/pricing";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import {
  attachPrimaryImage,
  escapeIlikeTerm,
} from "@/lib/storefront/_shared";
import {
  getStoreBySlug,
  STORE_CACHE_TAG,
} from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 50;
const TYPEAHEAD_LIMIT = 6;

export interface TypeaheadHit {
  id: string;
  slug: string;
  name: string;
  priceInCents: number;
  thumbUrl: string | null;
}

export type SearchTypeaheadResult =
  | { ok: true; items: TypeaheadHit[]; total: number }
  | { ok: false; error: "rate_limited" | "invalid_store" | "internal" };

async function runTypeahead(
  storeId: string,
  storeSlug: string,
  q: string,
): Promise<{ items: TypeaheadHit[]; total: number }> {
  return withTenant(storeId, null, async (tx) => {
    const where = and(
      eq(productTable.storeId, storeId),
      eq(productTable.isActive, true),
      eq(productTable.isPublishedToStorefront, true),
      ilike(productTable.name, escapeIlikeTerm(q)),
    );

    // SÉRIE no mesmo tx (pg client deprecou paralelas).
    const rows = await tx
      .select()
      .from(productTable)
      .where(where)
      .orderBy(desc(productTable.createdAt))
      .limit(TYPEAHEAD_LIMIT);

    const totalResult = await tx
      .select({ value: count() })
      .from(productTable)
      .where(where);

    const total = totalResult[0]?.value ?? 0;
    if (rows.length === 0) return { items: [], total };

    const cards = await attachPrimaryImage(tx, storeId, rows);
    const now = new Date();
    const items: TypeaheadHit[] = cards.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      priceInCents: getEffectivePrice(
        {
          basePriceInCents: c.basePriceInCents,
          promoPriceInCents: c.promoPriceInCents,
          promoStartsAt: c.promoStartsAt,
          promoEndsAt: c.promoEndsAt,
        },
        now,
      ),
      thumbUrl: c.primaryImageUrl,
    }));

    return { items, total };
  });
}

export async function searchTypeahead(
  storeSlug: string,
  rawQuery: string,
): Promise<SearchTypeaheadResult> {
  const q = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < MIN_QUERY_LENGTH) {
    return { ok: true, items: [], total: 0 };
  }

  const reqHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.publicApi, getClientIp(reqHeaders));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: "rate_limited" };
    }
    throw err;
  }

  const store = await getStoreBySlug(storeSlug);
  if (!store) return { ok: false, error: "invalid_store" };

  try {
    const cacheKey = [
      "storefront-typeahead",
      store.id,
      q.toLowerCase(),
    ];
    const cached = unstable_cache(
      async () => runTypeahead(store.id, store.slug, q),
      cacheKey,
      { tags: [STORE_CACHE_TAG(store.slug)], revalidate: 60 },
    );
    const { items, total } = await cached();
    return { ok: true, items, total };
  } catch (err) {
    logger.warn("storefront.typeahead.error", { storeSlug, q, err });
    return { ok: false, error: "internal" };
  }
}
