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
import { and, asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { brandTable, categoryTable, orderTable, userTable } from "@/db/schema";
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
  /**
   * R3 Relatórios (2026-05-29) — usuários que figuram como `seller_id`
   * em ao menos uma venda da loja. Alimenta filtro "Vendedora" em
   * /admin/relatorios/vendas. Esconde dropdown quando vazio (loja sem
   * comissão / sem operador atribuído).
   */
  sellers: ReportFilterOption[];
}

export async function loadReportFilterOptions(): Promise<ReportFilterOptions> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { categories: [], brands: [], sellers: [] };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { categories: [], brands: [], sellers: [] };

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

    // R3 — vendedoras DISTINCT a partir de order.sellerId. JOIN com
    // userTable pra resolver o nome. Ordena alfabético — o cliente vai
    // mostrar essa lista num <select>.
    const sellers = await tx
      .selectDistinct({ id: userTable.id, name: userTable.name })
      .from(orderTable)
      .innerJoin(userTable, eq(userTable.id, orderTable.sellerId))
      .where(
        and(
          eq(orderTable.storeId, store.id),
          sql`${orderTable.sellerId} IS NOT NULL`,
        ),
      )
      .orderBy(asc(userTable.name));

    return { categories, brands, sellers };
  });
}
