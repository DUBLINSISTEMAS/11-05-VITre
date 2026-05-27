/**
 * Página de busca/exploração de produtos.
 *
 * Features:
 * - Header próprio com barra de busca (sem duplicar com StoreHeader)
 * - Mostra TODOS os produtos quando não há termo de busca
 * - Filtra produtos quando usuário digita
 * - Design limpo e moderno estilo app de moda
 */
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Pagination } from "@/components/common/pagination";
import { CategoryStrip } from "@/components/storefront/category-strip";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SearchTypeahead } from "@/components/storefront/search-typeahead";
import {
  FavoritesButton,
  SacolaButton,
} from "@/components/storefront/store-header";
import { Button } from "@/components/ui/button";
import {
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";
import { getCategoryTree } from "@/lib/storefront/categories-loader";
import { searchProducts } from "@/lib/storefront/search-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type {
  CategoryShape,
  ProductCardVariant,
} from "@/lib/storefront/themes";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Explorar",
};

interface PageParams {
  storeSlug: string;
}

const buscarSearchSchema = z.object({
  q: searchTextSchema,
  page: pageNumberSchema,
});

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams]);
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const { q, page } = buscarSearchSchema.parse(sp);
  const baseHref = `/${store.slug}`;

  // Carrega categorias para os pills
  const categoryTree = await getCategoryTree(store.id, store.slug);

  // Sempre busca produtos (string vazia retorna todos)
  const result = await searchProducts({
    storeId: store.id,
    storeSlug: store.slug,
    q: q || "", // String vazia busca todos
    page,
    limit: PAGE_SIZE,
  });

  const buildHref = (p: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (p > 1) usp.set("page", String(p));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="flex flex-col min-h-screen -mx-4 -mt-4">
      {/* Onda 13 (2026-05-27) — auditoria de viewport real-state.
          STICKY MÍNIMO: 1 linha com [Back] [Pill] [♥] [🛍] = ~64px,
          mesmo padrão de altura do StoreHeader home. Antes o sticky
          tinha 3 linhas (back+título + pill + CategoryStrip) ocupando
          ~220px = 33% do viewport iPhone — cliente perdia área útil
          de produto ao scrollar.
          O título "Explorar" foi removido (pill ativo já comunica que
          a tela é de busca). CategoryStrip e contador "X resultados"
          foram pro conteúdo scrollável abaixo. */}
      <header className="sticky top-0 z-30 rounded-b-2xl bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-2.5">
          <Link href={baseHref} aria-label="Voltar">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full shrink-0"
            >
              <ArrowLeft className="size-5" />
              <span className="sr-only">Voltar</span>
            </Button>
          </Link>

          <form
            action={`/${store.slug}/buscar`}
            method="get"
            role="search"
            className="flex min-w-0 flex-1 items-center"
          >
            <SearchTypeahead storeSlug={store.slug} initialQuery={q} />
          </form>

          <FavoritesButton storeSlug={store.slug} />
          <SacolaButton variant="solid" />
        </div>
      </header>

      {/* Content — CategoryStrip e título de resultados scrollam junto.
          Cliente vê as categorias na primeira dobra; ao rolar pra ver
          produtos, sticky compacto libera ~150px de viewport extra. */}
      <div className="flex-1 px-4 pt-3 pb-4 space-y-4">
        <CategoryStrip
          storeSlug={store.slug}
          categories={categoryTree}
          shape={store.categoryShape as CategoryShape}
        />

        {q && (
          <p className="text-sm text-muted-foreground">
            {result.total === 0
              ? `Nenhum resultado para "${q}"`
              : result.total === 1
                ? `1 produto encontrado`
                : `${result.total} produtos encontrados`}
          </p>
        )}

        {!q && result.total > 0 && (
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Todos os Produtos
            </h2>
            <span className="text-xs text-muted-foreground">
              {result.total} {result.total === 1 ? "item" : "itens"}
            </span>
          </div>
        )}

        {result.items.length > 0 ? (
          <>
            <ProductGrid
              storeSlug={store.slug}
              products={result.items}
              priorityFirst
              priorityCount={4}
              variant={store.productCardStyle as ProductCardVariant}
            />
            {result.pageCount > 1 && (
              <Pagination
                currentPage={result.page}
                totalPages={result.pageCount}
                buildHref={buildHref}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <SearchIcon className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              {q ? "Nenhum produto encontrado" : "Vitrine vazia"}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {q
                ? "Tente outras palavras ou explore as categorias"
                : "Esta vitrine ainda não tem produtos cadastrados"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
