/**
 * Loader público de categorias da loja em árvore de 2 níveis.
 *
 * Modelo (catalog.ts): categoria com `parentId` opcional. Validação no
 * admin (`actions/category/create.ts` e `update.ts`) garante no máximo
 * 2 níveis (raiz + folha) — aqui assumimos isso e montamos a tree em
 * memória com 1 query única.
 *
 * Uso:
 *  - Sidebar drill-down (`CategoriesSidebar`).
 *  - Strip horizontal na home.
 *  - Resolver slug→categoria na rota `/categoria/[slug]`.
 */
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { Category } from "@/db/schema";
import { categoryTable } from "@/db/schema";
import { STORE_CACHE_TAG } from "@/lib/storefront/store-loader";
import { withTenant } from "@/lib/tenant";

export interface CategoryNode extends Category {
  children: Category[];
}

async function loadCategoryTreeFromDb(storeId: string): Promise<CategoryNode[]> {
  return withTenant(storeId, null, async (tx) => {
    const rows = await tx.query.categoryTable.findMany({
      where: and(
        eq(categoryTable.storeId, storeId),
        eq(categoryTable.isActive, true),
      ),
      orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
    });

    // Monta tree raiz→filhos em memória.
    const byParent = new Map<string, Category[]>();
    const roots: Category[] = [];
    for (const c of rows) {
      if (c.parentId === null) {
        roots.push(c);
      } else {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      }
    }

    return roots.map((r) => ({ ...r, children: byParent.get(r.id) ?? [] }));
  });
}

/**
 * Tree completa (2 níveis) das categorias ativas de uma loja.
 * Cached por storeSlug (caller passa pro key) — invalidação via
 * `revalidateTag(STORE_CACHE_TAG(slug))`.
 */
export const getCategoryTree = cache(
  async (storeId: string, storeSlug: string): Promise<CategoryNode[]> => {
    const cached = unstable_cache(
      async () => loadCategoryTreeFromDb(storeId),
      ["storefront-categories", storeId],
      { tags: [STORE_CACHE_TAG(storeSlug)], revalidate: 300 },
    );
    return cached();
  },
);

/**
 * Resolve categoria por slug (qualquer nível).
 * Retorna a categoria + seus filhos (vazio se for folha).
 */
export const getCategoryBySlug = cache(
  async (
    storeId: string,
    storeSlug: string,
    categorySlug: string,
  ): Promise<CategoryNode | null> => {
    const tree = await getCategoryTree(storeId, storeSlug);
    for (const root of tree) {
      if (root.slug === categorySlug) return root;
      const child = root.children.find((c) => c.slug === categorySlug);
      if (child) return { ...child, children: [] };
    }
    return null;
  },
);
