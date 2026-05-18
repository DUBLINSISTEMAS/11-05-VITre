/**
 * Loader público de produtos do storefront.
 *
 * Decisões arquiteturais (consenso do conselho-5-agentes para Fase 1.5):
 *
 * 1. Cacheamos campos BRUTOS (basePriceInCents, promoPriceInCents,
 *    promoStartsAt, promoEndsAt). O preço EFETIVO é calculado em
 *    request-time via `pricing.ts` — nunca cacheado, evita cliente ver
 *    promo expirada.
 *
 * 2. Filtro `priceMin/priceMax` usa basePrice (não promo). Razão: filtro
 *    é UX de descoberta, não preço final. Mostrar preço efetivo no card.
 *
 * 3. Estoque (`stockQuantity`) é cacheado com TTL curto (5min). Drift
 *    aceitável no catálogo; checkout (Fase 1.6) revalida fresh.
 *
 * 4. Hierarquia: categoria pai inclui produtos das filhas. Categoria
 *    folha só inclui ela.
 *
 * 5. Card mostra apenas 1ª imagem (position=0). PDP carrega todas.
 *
 * Helpers compartilhados (`attachPrimaryImage`, `ProductCardData`,
 * tipos comuns) vivem em `_shared.ts` e são importados também por
 * `search-loader.ts`. NÃO importe `_shared.ts` de fora deste diretório.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Product, ProductImage, ProductVariant } from "@/db/schema";
import { productImageTable, productTable, productVariantTable } from "@/db/schema";
import {
  attachPrimaryImage,
  DEFAULT_PRODUCT_LIMIT,
  type ListResult,
  MAX_PRODUCT_LIMIT,
  type ProductCardData,
} from "@/lib/storefront/_shared";
import { getCategoryBySlug } from "@/lib/storefront/categories-loader";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

export type { ProductCardData } from "@/lib/storefront/_shared";

// =====================================================================
// Tipos
// =====================================================================

export interface ProductDetail extends Product {
  images: ProductImage[];
  variants: ProductVariant[];
}

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "newest";

export interface ListProductsParams {
  storeId: string;
  storeSlug: string;
  categorySlug?: string;
  priceMinCents?: number;
  priceMaxCents?: number;
  /**
   * Filtra apenas produtos com promoção ativa AGORA. Usa now() server-side
   * (NOT NULL no preço, janela de datas válida com extremos opcionais).
   * Espelha `hasActivePromo` em pricing.ts.
   */
  promoOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export type ListProductsResult = ListResult;

// =====================================================================
// Helpers internos
// =====================================================================

/**
 * Resolve a lista de categoryIds a partir de um slug. Pai inclui filhas.
 * Retorna `null` quando o slug não existe (sinaliza "sem resultado").
 */
async function resolveCategoryIds(
  storeId: string,
  storeSlug: string,
  categorySlug: string,
): Promise<string[] | null> {
  const cat = await getCategoryBySlug(storeId, storeSlug, categorySlug);
  if (!cat) return null;
  return [cat.id, ...cat.children.map((c) => c.id)];
}

function applySort(sort: ProductSort) {
  switch (sort) {
    case "price_asc":
      return [asc(productTable.basePriceInCents), desc(productTable.createdAt)];
    case "price_desc":
      return [desc(productTable.basePriceInCents), desc(productTable.createdAt)];
    case "newest":
      return [desc(productTable.createdAt)];
    case "relevance":
    default:
      return [desc(productTable.isFeatured), desc(productTable.createdAt)];
  }
}

// =====================================================================
// listProducts — listagem paginada
// =====================================================================

async function loadProductsFromDb(
  params: ListProductsParams,
  categoryIds: string[] | null,
): Promise<ListProductsResult> {
  const {
    storeId,
    sort = "relevance",
    page = 1,
    limit = DEFAULT_PRODUCT_LIMIT,
  } = params;

  const safeLimit = Math.min(Math.max(1, limit), MAX_PRODUCT_LIMIT);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  return withTenant(storeId, null, async (tx) => {
    const conditions = [
      eq(productTable.storeId, storeId),
      eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
    ];

    if (categoryIds && categoryIds.length > 0) {
      conditions.push(inArray(productTable.categoryId, categoryIds));
    }
    if (params.priceMinCents !== undefined) {
      conditions.push(gte(productTable.basePriceInCents, params.priceMinCents));
    }
    if (params.priceMaxCents !== undefined) {
      conditions.push(lte(productTable.basePriceInCents, params.priceMaxCents));
    }

    if (params.promoOnly) {
      // Mesma lógica de `hasActivePromo`: preço promo presente, menor que
      // base, e janela de datas válida (extremos opcionais = sem limite).
      conditions.push(isNotNull(productTable.promoPriceInCents));
      conditions.push(
        sql`${productTable.promoPriceInCents} < ${productTable.basePriceInCents}`,
      );
      conditions.push(
        or(
          isNull(productTable.promoStartsAt),
          lte(productTable.promoStartsAt, sql`now()`),
        )!,
      );
      conditions.push(
        or(
          isNull(productTable.promoEndsAt),
          gte(productTable.promoEndsAt, sql`now()`),
        )!,
      );
    }

    const where = and(...conditions);

    // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
    const rows = await tx
      .select()
      .from(productTable)
      .where(where)
      .orderBy(...applySort(sort))
      .limit(safeLimit)
      .offset(offset);
    const totalResult = await tx
      .select({ value: count() })
      .from(productTable)
      .where(where);

    const items = await attachPrimaryImage(tx, storeId, rows);
    const total = totalResult[0]?.value ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / safeLimit));

    return { items, total, page: safePage, pageCount, limit: safeLimit };
  });
}

/**
 * Lista produtos paginada com filtros. Cached por chave que inclui
 * todos os filtros — invalidação via tag `store-${slug}`.
 *
 * Quando `categorySlug` é passado e não existe, retorna `null` (caller
 * responde 404). Quando categoria existe mas sem produtos, retorna
 * `{ items: [], total: 0, ... }`.
 */
export const listProducts = cache(
  async (params: ListProductsParams): Promise<ListProductsResult | null> => {
    let categoryIds: string[] | null = null;
    if (params.categorySlug) {
      categoryIds = await resolveCategoryIds(
        params.storeId,
        params.storeSlug,
        params.categorySlug,
      );
      if (categoryIds === null) return null;
    }

    // BYPASS cache quando filtro depende de tempo (`promoOnly` usa `now()`
    // server-side). Crítico C2 da auditoria 2026-05-12: `unstable_cache`
    // congela `now()` por TTL=5min, então promo que expirou às 10:00:00
    // continuaria aparecendo até 10:05. Volume baixo (URL `?promo=1` é
    // descoberta), uncached é aceitável; sub-50ms na maioria das lojas.
    if (params.promoOnly) {
      return loadProductsFromDb(params, categoryIds);
    }

    const cacheKey = [
      "storefront-products",
      params.storeId,
      params.categorySlug ?? "all",
      String(params.priceMinCents ?? ""),
      String(params.priceMaxCents ?? ""),
      "all-promo",
      params.sort ?? "relevance",
      String(params.page ?? 1),
      String(params.limit ?? DEFAULT_PRODUCT_LIMIT),
    ];

    const cached = unstable_cache(
      async () => loadProductsFromDb(params, categoryIds),
      cacheKey,
      { tags: [STORE_CACHE_TAG(params.storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);

// =====================================================================
// getProductBySlug — PDP
// =====================================================================

async function loadProductBySlugFromDb(
  storeId: string,
  productSlug: string,
): Promise<ProductDetail | null> {
  return withTenant(storeId, null, async (tx) => {
    const product = await tx.query.productTable.findFirst({
      where: and(
        eq(productTable.storeId, storeId),
        eq(productTable.slug, productSlug),
        eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
      ),
    });
    if (!product) return null;

    // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
    const images = await tx
      .select()
      .from(productImageTable)
      .where(
        and(
          eq(productImageTable.storeId, storeId),
          eq(productImageTable.productId, product.id),
        ),
      )
      .orderBy(asc(productImageTable.position));
    const variants = await tx
      .select()
      .from(productVariantTable)
      .where(
        and(
          eq(productVariantTable.storeId, storeId),
          eq(productVariantTable.productId, product.id),
          eq(productVariantTable.isActive, true),
        ),
      )
      .orderBy(asc(productVariantTable.name));

    return { ...product, images, variants };
  });
}

/**
 * Resolve produto público por slug com imagens e variantes ativas.
 * Cached por (storeId, productSlug) — invalidação via tag store-${slug}.
 */
export const getProductBySlug = cache(
  async (
    storeId: string,
    storeSlug: string,
    productSlug: string,
  ): Promise<ProductDetail | null> => {
    const cached = unstable_cache(
      async () => loadProductBySlugFromDb(storeId, productSlug),
      ["storefront-product", storeId, productSlug],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);

// =====================================================================
// Helpers de home: featured + recent
// =====================================================================

async function loadHomeProductsFromDb(
  storeId: string,
  onlyFeatured: boolean,
  limit: number,
): Promise<ProductCardData[]> {
  return withTenant(storeId, null, async (tx) => {
    const conditions = [
      eq(productTable.storeId, storeId),
      eq(productTable.isActive, true), eq(productTable.isPublishedToStorefront, true),
    ];
    if (onlyFeatured) conditions.push(eq(productTable.isFeatured, true));

    const rows = await tx
      .select()
      .from(productTable)
      .where(and(...conditions))
      .orderBy(desc(productTable.createdAt))
      .limit(limit);
    return attachPrimaryImage(tx, storeId, rows);
  });
}

export const getFeaturedProducts = cache(
  async (
    storeId: string,
    storeSlug: string,
    limit = 8,
  ): Promise<ProductCardData[]> => {
    const cached = unstable_cache(
      async () => loadHomeProductsFromDb(storeId, true, limit),
      ["storefront-featured", storeId, String(limit)],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);

export const getRecentProducts = cache(
  async (
    storeId: string,
    storeSlug: string,
    limit = 8,
  ): Promise<ProductCardData[]> => {
    const cached = unstable_cache(
      async () => loadHomeProductsFromDb(storeId, false, limit),
      ["storefront-recent", storeId, String(limit)],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);
