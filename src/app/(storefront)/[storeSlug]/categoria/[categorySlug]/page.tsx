/**
 * Página de categoria — listagem paginada de produtos com filtros.
 *
 * Server Component:
 *  - Resolve store + categoria. 404 se categoria não existe.
 *  - Lista produtos via `listProducts` (categoria pai inclui filhas).
 *  - Filtros (preço/sort) lidos da URL via searchParams.
 *  - Breadcrumb se a categoria tem pai.
 *  - Paginação simples (?page=N) reusando o componente comum.
 */
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/common/pagination";
import { FiltersDrawer } from "@/components/storefront/filters-drawer";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getCategoryBySlug,
  getCategoryTree,
} from "@/lib/storefront/categories-loader";
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
  });
  if (!result) notFound();

  let parentLink: { name: string; href: string } | null = null;
  if (category.parentId) {
    const tree = await getCategoryTree(store.id, store.slug);
    const parent = tree.find((root) => root.id === category.parentId);
    if (parent) {
      parentLink = {
        name: parent.name,
        href: `/${store.slug}/categoria/${parent.slug}`,
      };
    }
  }

  const basePath = `/${store.slug}/categoria/${category.slug}`;

  // buildHref: preserva todos os filtros, só atualiza page.
  const buildHref = (p: number) => {
    const usp = new URLSearchParams();
    if (priceMinCents !== undefined)
      usp.set("priceMin", String(priceMinCents));
    if (priceMaxCents !== undefined)
      usp.set("priceMax", String(priceMaxCents));
    if (sort !== "relevance") usp.set("sort", sort);
    if (p > 1) usp.set("page", String(p));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <nav aria-label="Caminho" className="text-muted-foreground text-sm">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link
                href={`/${store.slug}`}
                prefetch={false}
                className="hocus:text-foreground transition-colors"
              >
                Início
              </Link>
            </li>
            {parentLink && (
              <>
                <ChevronRight className="size-3.5" aria-hidden />
                <li>
                  <Link
                    href={parentLink.href}
                    prefetch={false}
                    className="hocus:text-foreground transition-colors"
                  >
                    {parentLink.name}
                  </Link>
                </li>
              </>
            )}
            <ChevronRight className="size-3.5" aria-hidden />
            <li className="text-foreground font-medium">{category.name}</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {category.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {result.total === 0
                ? "Nenhum produto"
                : result.total === 1
                  ? "1 produto"
                  : `${result.total} produtos`}
            </p>
          </div>
          <FiltersDrawer basePath={basePath} />
        </div>
      </header>

      {result.items.length === 0 ? (
        <div className="text-muted-foreground bg-muted/30 rounded-2xl px-6 py-12 text-center text-sm">
          <p className="text-base font-medium">Nenhum produto encontrado</p>
          <p className="text-muted-foreground/80 mt-1">
            Tente remover filtros de preço.
          </p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
