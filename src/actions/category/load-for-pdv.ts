"use server";

/**
 * loadCategoriesForPdv — Redesign PDV.
 *
 * Retorna categorias da loja com count de produtos ATIVOS — usado nos
 * chips de filtro do ProductPickerDialog (mostra "Roupa (12)" pro
 * lojista saber qual categoria tem produto pra mostrar).
 *
 * Read-only. Sem rate limit (autenticado + RLS-scoped via withTenant).
 * Ordena por position asc + name asc — mesma convenção do CRUD de
 * categorias.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { categoryTable, productTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface PdvCategoryHit {
  id: string;
  name: string;
  parentId: string | null;
  /** Count de produtos ATIVOS nessa categoria. Usado no chip "(N)". */
  productCount: number;
}

export async function loadCategoriesForPdv(): Promise<PdvCategoryHit[]> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];

  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, async (tx) => {
    // LEFT JOIN + GROUP BY pra trazer count de produtos por categoria
    // numa única round-trip. Categorias sem produto aparecem com 0.
    const rows = await tx
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        parentId: categoryTable.parentId,
        productCount: sql<number>`count(${productTable.id}) filter (where ${productTable.isActive} = true)::int`,
      })
      .from(categoryTable)
      .leftJoin(
        productTable,
        and(
          eq(productTable.categoryId, categoryTable.id),
          eq(productTable.storeId, store.id),
        ),
      )
      .where(
        and(
          eq(categoryTable.storeId, store.id),
          eq(categoryTable.isActive, true),
        ),
      )
      .groupBy(
        categoryTable.id,
        categoryTable.name,
        categoryTable.parentId,
        categoryTable.position,
      )
      .orderBy(asc(categoryTable.position), asc(categoryTable.name));

    return rows;
  });
}
