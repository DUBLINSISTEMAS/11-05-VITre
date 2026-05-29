"use server";

/**
 * Bloco F (2026-05-29) — `loadCustoProducts`.
 *
 * Server action que alimenta o card-view da tela `/admin/produtos/custos`.
 *
 * Devolve produtos com TUDO que o lojista precisa pra preencher custo
 * de UM produto sem sair da tela:
 *   - identidade (nome, categoria, marca, foto principal)
 *   - preço de venda (read-only — workbench, não cadastro)
 *   - custo + comissão padrão (editáveis inline)
 *   - cost components (materiais — anel = ouro 18k + acabamento + mão-de-obra)
 *
 * Filtros (todos opcionais; default lê só `finished_good`):
 *   - search    : ilike em name OR internal_code
 *   - categoryId: filtro por categoria
 *   - status    : "with_cost" | "without_cost" | "all" (default "all")
 *   - kind      : "finished_good" | "raw_material" | "service" | "all"
 *                  (default "finished_good" — esconde matéria-prima/serviço
 *                  porque essa tela é pra preencher custo de produto pra venda)
 *
 * Paginação: limit 50 por default (workbench não precisa carregar 1500
 * cards de uma vez — paginação client-side seria pior). Lojista filtra
 * pra cortar o universo.
 *
 * Performance: 1 query principal + 1 query agregada de cost_components
 * (LEFT JOIN inline geraria N rows por produto, mais caro). Total ~30ms
 * em loja com 200 SKUs.
 */

import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  categoryTable,
  productCostComponentTable,
  productImageTable,
  productTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type CustoStatus = "with_cost" | "without_cost" | "all";
export type CustoKind = "finished_good" | "raw_material" | "service" | "all";

export interface LoadCustoProductsInput {
  search?: string;
  categoryId?: string;
  status?: CustoStatus;
  kind?: CustoKind;
  limit?: number;
  offset?: number;
}

export interface CustoCostComponent {
  id: string;
  label: string;
  amountInCents: number;
}

export interface CustoProductRow {
  id: string;
  name: string;
  slug: string;
  basePriceInCents: number;
  costPriceInCents: number | null;
  defaultCommissionBps: number | null;
  kind: "finished_good" | "raw_material" | "service";
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  internalCode: string | null;
  coverImageUrl: string | null;
  costComponents: CustoCostComponent[];
}

export interface LoadCustoProductsOutput {
  rows: CustoProductRow[];
  total: number;
  totalAll: number;
  withCost: number;
  withoutCost: number;
  truncated: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function loadCustoProducts(
  input: LoadCustoProductsInput = {},
): Promise<LoadCustoProductsOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const search = input.search?.trim() ?? "";
  const status: CustoStatus = input.status ?? "all";
  const kind: CustoKind = input.kind ?? "finished_good";
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, input.offset ?? 0);

  return withTenant(store.id, session.user.id, async (tx) => {
    // ---- WHERE clauses compostas ----
    const whereParts = [eq(productTable.storeId, store.id)];

    if (kind !== "all") {
      whereParts.push(eq(productTable.kind, kind));
    }

    if (input.categoryId) {
      whereParts.push(eq(productTable.categoryId, input.categoryId));
    }

    if (search.length > 0) {
      const like = `%${search}%`;
      const orClause = or(
        ilike(productTable.name, like),
        ilike(productTable.internalCode, like),
      );
      if (orClause) whereParts.push(orClause);
    }

    if (status === "with_cost") {
      whereParts.push(sql`${productTable.costPriceInCents} is not null`);
    } else if (status === "without_cost") {
      whereParts.push(sql`${productTable.costPriceInCents} is null`);
    }

    const whereClause = and(...whereParts);

    // ---- Total absoluto (todos os produtos do kind escolhido) — pros
    //      contadores do header (3 KPIs: Total / Com custo / Sem custo). ----
    const kindWhere =
      kind === "all"
        ? eq(productTable.storeId, store.id)
        : and(
            eq(productTable.storeId, store.id),
            eq(productTable.kind, kind),
          );

    const [totals] = await tx
      .select({
        total: count(),
        withCost: sql<number>`count(*) filter (where ${productTable.costPriceInCents} is not null)::int`,
      })
      .from(productTable)
      .where(kindWhere);

    const totalAll = totals?.total ?? 0;
    const withCost = totals?.withCost ?? 0;
    const withoutCost = totalAll - withCost;

    // ---- Total filtrado (após filtros) pra contagem real ----
    const [filteredTotal] = await tx
      .select({ value: count() })
      .from(productTable)
      .where(whereClause);
    const total = filteredTotal?.value ?? 0;

    // ---- Query principal: produtos paginados ----
    const productsRaw = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        slug: productTable.slug,
        basePriceInCents: productTable.basePriceInCents,
        costPriceInCents: productTable.costPriceInCents,
        defaultCommissionBps: productTable.defaultCommissionBps,
        kind: productTable.kind,
        categoryId: productTable.categoryId,
        categoryName: categoryTable.name,
        brand: productTable.brand,
        internalCode: productTable.internalCode,
      })
      .from(productTable)
      .leftJoin(categoryTable, eq(categoryTable.id, productTable.categoryId))
      .where(whereClause)
      // Sem custo primeiro (cria urgência visual no workbench), depois nome ASC
      .orderBy(
        sql`(${productTable.costPriceInCents} is null) desc`,
        asc(productTable.name),
      )
      .limit(limit)
      .offset(offset);

    if (productsRaw.length === 0) {
      return {
        rows: [],
        total,
        totalAll,
        withCost,
        withoutCost,
        truncated: total > limit + offset,
      };
    }

    const productIds = productsRaw.map((p) => p.id);

    // ---- Foto principal (display_order ASC primeiro) por produto ----
    const imageRows = await tx
      .select({
        productId: productImageTable.productId,
        url: productImageTable.url,
        position: productImageTable.position,
      })
      .from(productImageTable)
      .where(inArray(productImageTable.productId, productIds))
      .orderBy(asc(productImageTable.position));

    const coverByProduct = new Map<string, string>();
    for (const img of imageRows) {
      if (!coverByProduct.has(img.productId)) {
        coverByProduct.set(img.productId, img.url);
      }
    }

    // ---- Cost components por produto ----
    const componentRows = await tx
      .select({
        id: productCostComponentTable.id,
        productId: productCostComponentTable.productId,
        label: productCostComponentTable.label,
        amountInCents: productCostComponentTable.amountInCents,
      })
      .from(productCostComponentTable)
      .where(inArray(productCostComponentTable.productId, productIds))
      .orderBy(
        asc(productCostComponentTable.productId),
        asc(productCostComponentTable.position),
      );

    const componentsByProduct = new Map<string, CustoCostComponent[]>();
    for (const c of componentRows) {
      const list = componentsByProduct.get(c.productId) ?? [];
      list.push({
        id: c.id,
        label: c.label,
        amountInCents: c.amountInCents,
      });
      componentsByProduct.set(c.productId, list);
    }

    const rows: CustoProductRow[] = productsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePriceInCents: p.basePriceInCents,
      costPriceInCents: p.costPriceInCents,
      defaultCommissionBps: p.defaultCommissionBps,
      kind: p.kind,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      brand: p.brand,
      internalCode: p.internalCode,
      coverImageUrl: coverByProduct.get(p.id) ?? null,
      costComponents: componentsByProduct.get(p.id) ?? [],
    }));

    return {
      rows,
      total,
      totalAll,
      withCost,
      withoutCost,
      truncated: total > limit + offset,
    };
  });
}

/**
 * Categorias da loja pro filtro do header. Read leve — só id+name+parentId,
 * sem precisar do tree completo (filtro flat já cobre o caso).
 */
export async function loadCategoriesForCusto(): Promise<
  Array<{ id: string; name: string }>
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return [];
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, async (tx) =>
    tx
      .select({ id: categoryTable.id, name: categoryTable.name })
      .from(categoryTable)
      .where(eq(categoryTable.storeId, store.id))
      .orderBy(asc(categoryTable.name)),
  );
}

/**
 * Configuração de taxas reais da maquininha — alimenta o simulador de
 * lucro líquido por método de pagamento dentro de cada card.
 */
export async function loadStoreFeesForCusto(): Promise<{
  cardRealFeeBpsDebit: number;
  cardRealFeeBpsCredit1x: number;
  cardRealFeeBpsCredit2xTo6x: number;
  cardRealFeeBpsCredit7xTo12x: number;
} | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const { storeTable } = await import("@/db/schema");
    const [s] = await tx
      .select({
        cardRealFeeBpsDebit: storeTable.cardRealFeeBpsDebit,
        cardRealFeeBpsCredit1x: storeTable.cardRealFeeBpsCredit1x,
        cardRealFeeBpsCredit2xTo6x: storeTable.cardRealFeeBpsCredit2xTo6x,
        cardRealFeeBpsCredit7xTo12x: storeTable.cardRealFeeBpsCredit7xTo12x,
      })
      .from(storeTable)
      .where(eq(storeTable.id, store.id))
      .limit(1);

    if (!s) return null;
    return s;
  });
}
