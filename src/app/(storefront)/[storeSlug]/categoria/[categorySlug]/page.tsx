/**
 * Página de categoria — listagem paginada de produtos com chips de filtro.
 *
 * Server Component:
 *  - Resolve store + categoria. 404 se categoria não existe.
 *  - Lista produtos via `listProducts` (categoria pai inclui filhas).
 *  - Filtros (preço/sort/promoOnly) lidos da URL via searchParams.
 *  - Header próprio `<StoreHeader variant="category">` (canvas VTCategoria).
 *  - Chips horizontais 3 fixos (Tudo / Em promoção / Novidades) — Lote 2.
 *  - Paginação simples (?page=N) reusando o componente comum.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Pagination } from "@/components/common/pagination";
import { CategoryFilterChips } from "@/components/storefront/category-filter-chips";
import { ProductGrid } from "@/components/storefront/product-grid";
import { StoreHeader } from "@/components/storefront/store-header";
import { env } from "@/lib/env";
import {
  boolFlagSchema,
  enumWithDefault,
  pageNumberSchema,
  priceCentsSchema,
} from "@/lib/page-search-params";
import { loadActiveAttributesForStore } from "@/lib/storefront/attributes-loader";
import { getCategoryBySlug } from "@/lib/storefront/categories-loader";
import {
  listProducts,
  type ProductSort,
} from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type { ProductCardVariant } from "@/lib/storefront/themes";

interface PageParams {
  storeSlug: string;
  categorySlug: string;
}

const PAGE_SIZE = 24;
const VALID_SORTS = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
] as const satisfies readonly ProductSort[];

const categoriaSearchSchema = z.object({
  page: pageNumberSchema,
  priceMin: priceCentsSchema,
  priceMax: priceCentsSchema,
  sort: enumWithDefault(VALID_SORTS, "relevance"),
  promo: boolFlagSchema,
  // Sprint 5.5 — filtro por attribute_value (single UUID).
  attr: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .catch(null),
});

function formatPiecesCounter(total: number): string {
  if (total === 0) return "0 PEÇAS";
  if (total === 1) return "1 PEÇA";
  return `${total} PEÇAS`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ storeSlug, categorySlug }, sp] = await Promise.all([
    params,
    searchParams,
  ]);
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Não encontrado" };
  const category = await getCategoryBySlug(store.id, store.slug, categorySlug);
  if (!category) return { title: "Categoria não encontrada" };

  // Canonical aponta sempre pra página 1, sem filtros — evita duplicate
  // content por paginação/sort/promo (Google rebaixaria as variantes).
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const canonical = `${baseUrl}/${storeSlug}/categoria/${categorySlug}`;
  const { page } = categoriaSearchSchema.parse(sp);

  return {
    title: category.name,
    description: `Produtos de ${category.name} — ${store.name}.`,
    alternates: { canonical },
    // Página >1 sem valor SEO próprio — evita índice paginado infinito.
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ storeSlug, categorySlug }, sp] = await Promise.all([
    params,
    searchParams,
  ]);
  const {
    page,
    sort,
    priceMin: priceMinCents,
    priceMax: priceMaxCents,
    promo: promoOnly,
    attr: attributeValueId,
  } = categoriaSearchSchema.parse(sp);

  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const category = await getCategoryBySlug(store.id, store.slug, categorySlug);
  if (!category) notFound();

  const [result, attributes] = await Promise.all([
    listProducts({
      storeId: store.id,
      storeSlug: store.slug,
      categorySlug,
      page,
      limit: PAGE_SIZE,
      sort,
      priceMinCents,
      priceMaxCents,
      promoOnly,
      attributeValueId: attributeValueId ?? undefined,
    }),
    loadActiveAttributesForStore(store.id, store.slug),
  ]);
  if (!result) notFound();

  const basePath = `/${store.slug}/categoria/${category.slug}`;

  // buildHref: preserva todos os filtros, só atualiza page.
  const buildHref = (p: number) => {
    const usp = new URLSearchParams();
    if (priceMinCents !== undefined)
      usp.set("priceMin", String(priceMinCents));
    if (priceMaxCents !== undefined)
      usp.set("priceMax", String(priceMaxCents));
    if (sort !== "relevance") usp.set("sort", sort);
    if (promoOnly) usp.set("promo", "1");
    if (attributeValueId) usp.set("attr", attributeValueId);
    if (p > 1) usp.set("page", String(p));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <>
      <StoreHeader
        variant="category"
        store={store}
        kicker="CATEGORIA"
        title={category.name}
        counter={formatPiecesCounter(result.total)}
      />

      <CategoryFilterChips basePath={basePath} attributes={attributes} />

      <div className="px-4 pb-24 pt-1 lg:pb-12">
        {result.items.length === 0 ? (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-6 py-12 text-center text-sm">
            <p className="text-base font-medium">Nenhum produto encontrado</p>
            <p className="text-muted-foreground/80 mt-1">
              {promoOnly
                ? "Sem promoções ativas no momento."
                : "Tente remover filtros."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <ProductGrid
              storeSlug={store.slug}
              products={result.items}
              priorityFirst
              priorityCount={1}
              variant={store.productCardStyle as ProductCardVariant}
            />
            <Pagination
              currentPage={result.page}
              totalPages={result.pageCount}
              buildHref={buildHref}
            />
          </div>
        )}
      </div>
    </>
  );
}
