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

import { Pagination } from "@/components/common/pagination";
import { CategoryFilterChips } from "@/components/storefront/category-filter-chips";
import { ProductGrid } from "@/components/storefront/product-grid";
import { StoreHeader } from "@/components/storefront/store-header";
import { getCategoryBySlug } from "@/lib/storefront/categories-loader";
import {
  listProducts,
  type ProductSort,
} from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

interface PageParams {
  storeSlug: string;
  categorySlug: string;
}

interface SearchParams {
  page?: string;
  priceMin?: string;
  priceMax?: string;
  sort?: string;
  promo?: string;
}

const PAGE_SIZE = 24;
const VALID_SORTS: ProductSort[] = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
];

function parseSortParam(value: string | undefined): ProductSort {
  if (value && (VALID_SORTS as string[]).includes(value)) {
    return value as ProductSort;
  }
  return "relevance";
}

function parsePriceParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num);
}

function formatPiecesCounter(total: number): string {
  if (total === 0) return "0 PEÇAS";
  if (total === 1) return "1 PEÇA";
  return `${total} PEÇAS`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { storeSlug, categorySlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Não encontrado" };
  const category = await getCategoryBySlug(store.id, store.slug, categorySlug);
  if (!category) return { title: "Categoria não encontrada" };

  return {
    title: category.name,
    description: `Produtos de ${category.name} — ${store.name}.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ storeSlug, categorySlug }, sp] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = parseSortParam(sp.sort);
  const priceMinCents = parsePriceParam(sp.priceMin);
  const priceMaxCents = parsePriceParam(sp.priceMax);
  const promoOnly = sp.promo === "1";

  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const category = await getCategoryBySlug(store.id, store.slug, categorySlug);
  if (!category) notFound();

  const result = await listProducts({
    storeId: store.id,
    storeSlug: store.slug,
    categorySlug,
    page,
    limit: PAGE_SIZE,
    sort,
    priceMinCents,
    priceMaxCents,
    promoOnly,
  });
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

      <CategoryFilterChips basePath={basePath} />

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
