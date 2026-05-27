/**
 * Página de categoria — listagem paginada de produtos.
 *
 * Onda 22 (2026-05-27): substituiu CategoryFilterChips por CategoryStrip
 * de subcategorias (children se raiz; siblings se folha). Cliente que
 * entra em "Joias" vê tiles visuais de "Anéis", "Brincos", "Colares" no
 * mesmo formato/tamanho da home — sistema tipográfico e visual coerente.
 * Filtros Sheet (preço/sort/promo/atributos) removidos: cliente que
 * precisar de filtro avançado pode usar /buscar (typeahead + sheet).
 *
 * Server Component:
 *  - Resolve store + categoria via getCategoryTree (cached).
 *  - Lista produtos via listProducts (categoria pai inclui filhas).
 *  - Paginação simples (?page=N).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Pagination } from "@/components/common/pagination";
import { CategoryStrip } from "@/components/storefront/category-strip";
import { ProductGrid } from "@/components/storefront/product-grid";
import { StoreHeader } from "@/components/storefront/store-header";
import { env } from "@/lib/env";
import {
  getCategoryTree,
  type CategoryNode,
} from "@/lib/storefront/categories-loader";
import { listProducts } from "@/lib/storefront/products-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type {
  CategoryShape,
  ProductCardVariant,
} from "@/lib/storefront/themes";

interface PageParams {
  storeSlug: string;
  categorySlug: string;
}

const PAGE_SIZE = 24;

const categoriaSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
});

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

  const tree = await getCategoryTree(store.id, store.slug);
  const { current: category } = findCategoryWithSiblings(tree, categorySlug);
  if (!category) return { title: "Categoria não encontrada" };

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const canonical = `${baseUrl}/${storeSlug}/categoria/${categorySlug}`;
  const { page } = categoriaSearchSchema.parse(sp);

  return {
    title: category.name,
    description: `Produtos de ${category.name} — ${store.name}.`,
    alternates: { canonical },
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

/**
 * Resolve categoria atual + categorias pra renderizar no strip:
 *  - Se atual é raiz: retorna seus children
 *  - Se atual é folha: retorna seus siblings (children do parent)
 *  - Se atual não tem children E não tem siblings: retorna []
 */
function findCategoryWithSiblings(
  tree: CategoryNode[],
  slug: string,
): { current: CategoryNode | null; navCategories: CategoryNode[] } {
  // Tentar como raiz
  const root = tree.find((r) => r.slug === slug);
  if (root) {
    return {
      current: root,
      navCategories: root.children.map((c) => ({ ...c, children: [] })),
    };
  }
  // Tentar como folha — procurar parent
  for (const r of tree) {
    const child = r.children.find((c) => c.slug === slug);
    if (child) {
      return {
        current: { ...child, children: [] },
        // Siblings = todos os children do parent (inclui a atual; CategoryStrip
        // marca a ativa com activeSlug).
        navCategories: r.children.map((c) => ({ ...c, children: [] })),
      };
    }
  }
  return { current: null, navCategories: [] };
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
  const { page } = categoriaSearchSchema.parse(sp);

  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const tree = await getCategoryTree(store.id, store.slug);
  const { current: category, navCategories } = findCategoryWithSiblings(
    tree,
    categorySlug,
  );
  if (!category) notFound();

  const result = await listProducts({
    storeId: store.id,
    storeSlug: store.slug,
    categorySlug,
    page,
    limit: PAGE_SIZE,
    sort: "relevance",
  });
  if (!result) notFound();

  // buildHref: só preserva page (sem filtros agora).
  const buildHref = (p: number) => {
    const usp = new URLSearchParams();
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
      />

      {/* Onda 22 (2026-05-27): CategoryStrip de subcategorias (children
          ou siblings) substitui o antigo CategoryFilterChips. Mesmo
          formato visual da home — coerência cross-tela. Categoria atual
          marcada com ring forte via activeSlug. */}
      {navCategories.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <CategoryStrip
            storeSlug={store.slug}
            categories={navCategories}
            shape={store.categoryShape as CategoryShape}
            activeSlug={category.slug}
          />
        </div>
      )}

      {/* pb-20 mobile reserva safe-zone pra MiniCartBar; footer cobre
          bottom-nav (Onda 18). pt-3 quando há strip de subcategorias,
          pt-1 quando não. */}
      <div
        className={`${navCategories.length > 0 ? "pt-3" : "pt-1"} px-4 pb-20 lg:pb-12`}
      >
        {result.items.length === 0 ? (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-6 py-12 text-center text-sm">
            <p className="text-base font-medium">Nenhum produto encontrado</p>
            <p className="text-muted-foreground/80 mt-1">
              Esta categoria ainda não tem produtos.
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
