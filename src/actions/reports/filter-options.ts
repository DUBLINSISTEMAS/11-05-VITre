"use server";

/**
 * loadReportFilterOptions — Sprint 4.2 (2026-05-22).
 *
 * Lista enxuta de categorias e marcas pra alimentar os dropdowns multi-
 * select do relatório de vendas. Só id + name (sem count nem hierarquia)
 * — UI do filtro não precisa.
 *
 * Read-only, sem rate limit (autenticado + RLS via withTenant).
 */
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { brandTable, categoryTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface ReportFilterOption {
  id: string;
  name: string;
}

export interface ReportFilterOptions {
  categories: ReportFilterOption[];
  brands: ReportFilterOption[];
}

export async function loadReportFilterOptions(): Promise<ReportFilterOptions> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { categories: [], brands: [] };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { categories: [], brands: [] };

  return withTenant(store.id, session.user.id, async (tx) => {
    const categories = await tx
      .select({ id: categoryTable.id, name: categoryTable.name })
      .from(categoryTable)
      .where(
        and(
          eq(categoryTable.storeId, store.id),
          eq(categoryTable.isActive, true),
        ),
      )
      .orderBy(asc(categoryTable.position), asc(categoryTable.name));

    const brands = await tx
      .select({ id: brandTable.id, name: brandTable.name })
      .from(brandTable)
      .where(eq(brandTable.storeId, store.id))
      .orderBy(asc(brandTable.name));

    return { categories, brands };
  });
}
