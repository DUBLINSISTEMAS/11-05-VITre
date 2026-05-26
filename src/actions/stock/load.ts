"use server";

import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import {
  categoryTable,
  productImageTable,
  productTable,
  productVariantTable,
  stockMovementTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type {
  CountableInventoryRow,
  ListMovementsParams,
  ListMovementsResult,
  LoadStockSnapshotParams,
  LoadStockSnapshotResult,
  StockKpis,
  StockMovementRow,
  StockSnapshotRow,
  StockSnapshotSort,
} from "./types";

function trackedVariantExistsSql(storeId: string) {
  return sql`EXISTS (
    SELECT 1
      FROM product_variant pv
     WHERE pv.product_id = ${productTable.id}
       AND pv.store_id = ${storeId}
       AND pv.is_active = true
       AND pv.track_stock = true
  )`;
}

function trackedVariantStockSql(storeId: string) {
  return sql`COALESCE((
    SELECT SUM(pv.stock_quantity)
      FROM product_variant pv
     WHERE pv.product_id = ${productTable.id}
       AND pv.store_id = ${storeId}
       AND pv.is_active = true
       AND pv.track_stock = true
  ), 0)`;
}

function effectiveStockSql(storeId: string) {
  return sql`CASE
    WHEN ${trackedVariantExistsSql(storeId)}
      THEN ${trackedVariantStockSql(storeId)}
    ELSE ${productTable.stockQuantity}
  END`;
}

function controlsStockSql(storeId: string) {
  return sql`(${productTable.trackStock} = true OR ${trackedVariantExistsSql(storeId)})`;
}

/**
 * Lista movimentações de estoque do tenant atual com filtros (Fase 4 —
 * ADR-0015). Server function pra ser chamada pelo page.tsx do admin.
 *
 * Filtros:
 *   - q:           busca por nome de produto/variant (ilike)
 *   - movementType: enum filter
 *   - page/pageSize: paginação
 */
export async function listStockMovements(
  params: ListMovementsParams = {},
): Promise<ListMovementsResult> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], total: 0 };

  const pageSize = Math.max(1, Math.min(params.pageSize ?? 30, 100));
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * pageSize;

  return withTenant(store.id, session.user.id, async (tx) => {
    const conditions: SQL[] = [eq(stockMovementTable.storeId, store.id)];

    if (params.movementType) {
      conditions.push(eq(stockMovementTable.movementType, params.movementType));
    }

    // Audit 2026-05-26 — filtro de data inclusivo (range Hoje/Ontem/7d/Mês
    // OU range custom). gte/lte aplicados quando o caller passar.
    if (params.fromDate) {
      conditions.push(gte(stockMovementTable.createdAt, params.fromDate));
    }
    if (params.toDate) {
      conditions.push(lte(stockMovementTable.createdAt, params.toDate));
    }

    // Busca por nome de produto ou variante.
    if (params.q) {
      const safeQ = params.q.replace(/[\\%_]/g, "\\$&");
      const matchingProducts = await tx
        .select({ id: productTable.id })
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            ilike(productTable.name, `%${safeQ}%`),
          ),
        )
        .limit(200);
      const matchingVariants = await tx
        .select({ id: productVariantTable.id })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.storeId, store.id),
            ilike(productVariantTable.name, `%${safeQ}%`),
          ),
        )
        .limit(200);
      const productIds = matchingProducts.map((p) => p.id);
      const variantIds = matchingVariants.map((v) => v.id);
      if (productIds.length === 0 && variantIds.length === 0) {
        return { items: [], total: 0 };
      }
      const searchConditions: SQL[] = [];
      if (productIds.length > 0) {
        searchConditions.push(inArray(stockMovementTable.productId, productIds));
      }
      if (variantIds.length > 0) {
        searchConditions.push(inArray(stockMovementTable.variantId, variantIds));
      }
      conditions.push(or(...searchConditions)!);
    }

    const where = and(...conditions);

    const totalRows = await tx
      .select({ value: count() })
      .from(stockMovementTable)
      .where(where);
    const total = totalRows[0]?.value ?? 0;

    if (total === 0) return { items: [], total: 0 };

    const rows = await tx
      .select({
        id: stockMovementTable.id,
        productId: stockMovementTable.productId,
        productName: productTable.name,
        variantId: stockMovementTable.variantId,
        variantName: productVariantTable.name,
        movementType: stockMovementTable.movementType,
        quantityDelta: stockMovementTable.quantityDelta,
        referenceType: stockMovementTable.referenceType,
        referenceId: stockMovementTable.referenceId,
        notes: stockMovementTable.notes,
        createdAt: stockMovementTable.createdAt,
      })
      .from(stockMovementTable)
      .leftJoin(productTable, eq(stockMovementTable.productId, productTable.id))
      .leftJoin(
        productVariantTable,
        eq(stockMovementTable.variantId, productVariantTable.id),
      )
      .where(where)
      .orderBy(desc(stockMovementTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items: StockMovementRow[] = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.productName ?? "(produto removido)",
      variantId: r.variantId,
      variantName: r.variantName,
      movementType: r.movementType,
      quantityDelta: r.quantityDelta,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      notes: r.notes,
      createdAt: r.createdAt,
    }));

    return { items, total };
  });
}

/**
 * Estatísticas de estoque pro topo da página /admin/estoque
 * (follow-up Fase 4 — ADR-0015).
 *
 * Janela "mês corrente" = do dia 1 do mês atual (00:00 local server)
 * até agora. Servidor Vercel roda em UTC, mas a precisão de mês não
 * exige tz exata — diferença de até 3h é aceitável pra um KPI.
 */
export async function loadStockKpis(): Promise<StockKpis> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return {
      currentCostInCents: 0,
      currentSaleInCents: 0,
      currentUnits: 0,
      monthPurchases: 0,
      monthOut: 0,
      monthAdjustments: 0,
      monthAdjustmentsAbsTotal: 0,
    };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return withTenant(store.id, session.user.id, async (tx) => {
    // Audit 2026-05-26 — KPIs em R$ (não mais só unidades). Produtos rascunho
    // (slug "draft-%") excluídos pra match do KPI com a tabela snapshot.
    //
    // Produto SEM variantes: usa product.stock × product.price/cost.
    // Produto COM variantes: usa variant.stock × product.price/cost (variantes
    // não têm preço próprio em snapshot KPI — sprint futura pode refinar).
    const productAggRow = await tx
      .select({
        units: sql<string>`COALESCE(SUM(${productTable.stockQuantity}), 0)`,
        sale: sql<string>`COALESCE(SUM(${productTable.stockQuantity} * ${productTable.basePriceInCents}), 0)`,
        cost: sql<string>`COALESCE(SUM(${productTable.stockQuantity} * COALESCE(${productTable.costPriceInCents}, 0)), 0)`,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          sql`${productTable.slug} NOT LIKE 'draft-%'`,
          sql`NOT EXISTS (
            SELECT 1
              FROM product_variant pv
             WHERE pv.product_id = ${productTable.id}
               AND pv.store_id = ${store.id}
               AND pv.track_stock = true
          )`,
        ),
      );

    // S2.6 (2026-05-26) — KPI honra variant.cost_price_in_cents quando
    // disponível. Antes usava sempre product.costPriceInCents, fazendo o
    // KPI mentir em loja com variantes que têm cost próprio (ouro vs banhado).
    // Idem pra preço (sale): coalesce(variant.priceInCents, product.basePriceInCents).
    const variantAggRow = await tx
      .select({
        units: sql<string>`COALESCE(SUM(${productVariantTable.stockQuantity}), 0)`,
        sale: sql<string>`COALESCE(SUM(${productVariantTable.stockQuantity} * COALESCE(${productVariantTable.priceInCents}, ${productTable.basePriceInCents})), 0)`,
        cost: sql<string>`COALESCE(SUM(${productVariantTable.stockQuantity} * COALESCE(${productVariantTable.costPriceInCents}, ${productTable.costPriceInCents}, 0)), 0)`,
      })
      .from(productVariantTable)
      .innerJoin(
        productTable,
        eq(productTable.id, productVariantTable.productId),
      )
      .where(
        and(
          eq(productVariantTable.storeId, store.id),
          eq(productVariantTable.trackStock, true),
          sql`${productTable.slug} NOT LIKE 'draft-%'`,
        ),
      );

    const currentUnits =
      Number(productAggRow[0]?.units ?? 0) +
      Number(variantAggRow[0]?.units ?? 0);
    const currentSaleInCents =
      Number(productAggRow[0]?.sale ?? 0) +
      Number(variantAggRow[0]?.sale ?? 0);
    const currentCostInCents =
      Number(productAggRow[0]?.cost ?? 0) +
      Number(variantAggRow[0]?.cost ?? 0);

    // 2) movimentações do mês via stock_movement.
    const monthWhere = and(
      eq(stockMovementTable.storeId, store.id),
      gte(stockMovementTable.createdAt, monthStart),
      lte(stockMovementTable.createdAt, now),
    );

    // Audit 2026-05-26 — "Entradas do mês" virou "Compras no mês": filtra
    // apenas `manual_in` (compras lançadas via dialog). `initial` (saldo
    // inicial / backfill) e `return` (devolução) inflavam o KPI.
    const purchasesRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${stockMovementTable.quantityDelta}), 0)`,
      })
      .from(stockMovementTable)
      .where(
        and(monthWhere, eq(stockMovementTable.movementType, "manual_in")),
      );
    const monthPurchases = Number(purchasesRow[0]?.value ?? 0);

    const outRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${stockMovementTable.quantityDelta}), 0)`,
      })
      .from(stockMovementTable)
      .where(and(monthWhere, lte(stockMovementTable.quantityDelta, -1)));
    const monthOut = Math.abs(Number(outRow[0]?.value ?? 0));

    const adjRow = await tx
      .select({
        countValue: count(),
        absValue: sql<string>`COALESCE(SUM(ABS(${stockMovementTable.quantityDelta})), 0)`,
      })
      .from(stockMovementTable)
      .where(and(monthWhere, eq(stockMovementTable.movementType, "adjustment")));
    const monthAdjustments = Number(adjRow[0]?.countValue ?? 0);
    const monthAdjustmentsAbsTotal = Number(adjRow[0]?.absValue ?? 0);

    return {
      currentCostInCents,
      currentSaleInCents,
      currentUnits,
      monthPurchases,
      monthOut,
      monthAdjustments,
      monthAdjustmentsAbsTotal,
    };
  });
}

/**
 * Sprint 3C — produtos contábeis pra UI de contagem física.
 *
 * Retorna 1 linha por entidade rastreada:
 *   - produto SEM variantes trackStock: 1 linha do próprio produto
 *   - produto COM variantes trackStock: 1 linha por variante
 *
 * Limite hard: 1500 linhas (corte defensivo; UI sugere busca/filtragem
 * acima disso). Ordenação: nome do produto, depois nome da variante.
 *
 * Inclui só produtos `is_active = true` — descontinuados não aparecem na
 * contagem (relatório separado pra cuidar de saldo residual).
 */
export async function loadCountableInventory(): Promise<CountableInventoryRow[]> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, async (tx) => {
    // 1) produtos trackStock=true sem variantes trackStock (saldo no produto).
    const standaloneRows = await tx
      .select({
        productId: productTable.id,
        productName: productTable.name,
        categoryName: categoryTable.name,
        unit: productTable.unit,
        stockQuantity: productTable.stockQuantity,
        minStockQuantity: productTable.minStockQuantity,
        internalCode: productTable.internalCode,
        gtin: productTable.gtin,
      })
      .from(productTable)
      .leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          eq(productTable.isActive, true),
          sql`NOT EXISTS (
            SELECT 1
              FROM product_variant pv
             WHERE pv.product_id = ${productTable.id}
               AND pv.store_id = ${store.id}
               AND pv.track_stock = true
          )`,
        ),
      )
      .orderBy(productTable.name)
      .limit(1500);

    // 2) variantes trackStock=true (saldo na variante). GTIN/internalCode/
    //    minStock vivem no produto pai — replicados pra cada linha.
    const variantRows = await tx
      .select({
        productId: productVariantTable.productId,
        variantId: productVariantTable.id,
        productName: productTable.name,
        variantName: productVariantTable.name,
        categoryName: categoryTable.name,
        unit: productTable.unit,
        stockQuantity: productVariantTable.stockQuantity,
        minStockQuantity: productTable.minStockQuantity,
        internalCode: productVariantTable.sku,
        gtin: productTable.gtin,
      })
      .from(productVariantTable)
      .innerJoin(
        productTable,
        eq(productVariantTable.productId, productTable.id),
      )
      .leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
      .where(
        and(
          eq(productVariantTable.storeId, store.id),
          eq(productVariantTable.trackStock, true),
          eq(productTable.isActive, true),
        ),
      )
      .orderBy(productTable.name, productVariantTable.name)
      .limit(1500);

    const rows: CountableInventoryRow[] = [
      ...standaloneRows.map((r) => ({
        productId: r.productId,
        variantId: null,
        productName: r.productName,
        variantName: null,
        categoryName: r.categoryName,
        unit: r.unit,
        stockQuantity: r.stockQuantity ?? 0,
        minStockQuantity: r.minStockQuantity ?? null,
        internalCode: r.internalCode,
        gtin: r.gtin,
      })),
      ...variantRows.map((r) => ({
        productId: r.productId,
        variantId: r.variantId,
        productName: r.productName,
        variantName: r.variantName,
        categoryName: r.categoryName,
        unit: r.unit,
        stockQuantity: r.stockQuantity ?? 0,
        minStockQuantity: r.minStockQuantity ?? null,
        internalCode: r.internalCode,
        gtin: r.gtin,
      })),
    ];

    rows.sort((a, b) => {
      const byProd = a.productName.localeCompare(b.productName, "pt-BR");
      if (byProd !== 0) return byProd;
      return (a.variantName ?? "").localeCompare(b.variantName ?? "", "pt-BR");
    });

    return rows.slice(0, 1500);
  });
}

/**
 * Onda 1.4 (2026-05-24) — snapshot de saldo por produto pra aba primária
 * em /admin/estoque. Endpoint substitui o mental model anterior (feed
 * event-sourced) que era o programador-paradigma, pelo que o lojista
 * espera: planilha-tipo-contador com produto/saldo/min/status.
 *
 * Lê do CACHE `product.stock_quantity` (event-sourced via stock_movement
 * trigger). Cache é refletido sincronamente em todo INSERT do feed pelo
 * trigger SQL `sync_stock_cache_on_movement` (SQL 24/43/60), então não há
 * drift entre snapshot e feed.
 *
 * Inclui produtos `trackStock=false` (com badge UI) pra cobrir o gap
 * histórico onde lojista cadastrava sem ligar tracking — agora aparece
 * no snapshot pra revisão consciente.
 *
 * NÃO inclui drafts (slug LIKE 'draft-%' ou nome vazio) — produto em
 * cadastro inicial polui a visão.
 */
export async function loadStockSnapshot(
  params: LoadStockSnapshotParams = {},
): Promise<LoadStockSnapshotResult> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], total: 0 };

  const pageSize = Math.max(1, Math.min(params.pageSize ?? 30, 100));
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * pageSize;
  const status = params.status ?? "all";
  const sort: StockSnapshotSort = params.sort ?? "name-asc";

  return withTenant(store.id, session.user.id, async (tx) => {
    const conditions: SQL[] = [
      eq(productTable.storeId, store.id),
      sql`${productTable.slug} not like 'draft-%'`,
      sql`btrim(${productTable.name}) <> ''`,
    ];

    if (params.q) {
      const safeQ = params.q.replace(/[\\%_]/g, "\\$&");
      conditions.push(ilike(productTable.name, `%${safeQ}%`));
    }

    // Sprint flash 2026-05-24 — filtro de categoria (Bloco 4). Antes a
    // snapshot só dava pra filtrar por status; lojista com 200 SKUs em
    // 6 categorias precisava abrir cada uma manualmente.
    if (params.categoryId) {
      conditions.push(eq(productTable.categoryId, params.categoryId));
    }

    const effectiveStock = effectiveStockSql(store.id);
    const controlsStock = controlsStockSql(store.id);

    // Filtros mutex de status — só um aplicado por vez.
    if (status === "with-stock") {
      conditions.push(controlsStock);
      conditions.push(sql`${effectiveStock} > 0`);
    } else if (status === "zero") {
      conditions.push(controlsStock);
      conditions.push(sql`${effectiveStock} = 0`);
    } else if (status === "low") {
      // Abaixo do mínimo configurado E rastreado E acima de zero (zero
      // já tem sua própria aba).
      conditions.push(controlsStock);
      conditions.push(sql`${productTable.minStockQuantity} is not null`);
      conditions.push(
        sql`${effectiveStock} > 0 and ${effectiveStock} <= ${productTable.minStockQuantity}`,
      );
    } else if (status === "no-tracking") {
      conditions.push(sql`NOT ${controlsStock}`);
    } else if (status === "alerts") {
      // Audit 2026-05-26 — combo "zero" ∪ "low" pra tab Alertas. Server-side
      // OR (em vez de 2 queries paginadas separadas + merge local que mente
      // o total). Inclui: trackStock=true E (estoque=0 OU estoque <= min).
      conditions.push(controlsStock);
      conditions.push(
        sql`(${effectiveStock} = 0 OR (${productTable.minStockQuantity} IS NOT NULL AND ${effectiveStock} <= ${productTable.minStockQuantity}))`,
      );
    }

    const where = and(...conditions);

    // Sprint flash 2026-05-24 — sort dinâmico (Bloco 4). Stock e min usam
    // SQL CASE pra mandar NULL pro final do ASC (produtos sem controle
    // não devem dominar a primeira página quando lojista ordena por
    // saldo crescente — semântica esperada "menores que TÊM saldo primeiro").
    const orderClause: SQL = (() => {
      switch (sort) {
        case "name-desc":
          return sql`${productTable.name} desc`;
        case "stock-asc":
          return sql`${effectiveStock} asc nulls last, ${productTable.name} asc`;
        case "stock-desc":
          return sql`${effectiveStock} desc nulls last, ${productTable.name} asc`;
        case "min-asc":
          return sql`${productTable.minStockQuantity} asc nulls last, ${productTable.name} asc`;
        case "min-desc":
          return sql`${productTable.minStockQuantity} desc nulls last, ${productTable.name} asc`;
        case "name-asc":
        default:
          return sql`${productTable.name} asc`;
      }
    })();

    // Total pra paginação.
    const totalRows = await tx
      .select({ value: count() })
      .from(productTable)
      .where(where);
    const total = totalRows[0]?.value ?? 0;

    if (total === 0) return { items: [], total: 0 };

    // Página corrente — só colunas necessárias.
    const rows = await tx
      .select({
        productId: productTable.id,
        productName: productTable.name,
        productSlug: productTable.slug,
        categoryName: categoryTable.name,
        trackStock: productTable.trackStock,
        stockQuantity: productTable.stockQuantity,
        minStockQuantity: productTable.minStockQuantity,
        unit: productTable.unit,
        basePriceInCents: productTable.basePriceInCents,
        costPriceInCents: productTable.costPriceInCents,
        isActive: productTable.isActive,
      })
      .from(productTable)
      .leftJoin(categoryTable, eq(productTable.categoryId, categoryTable.id))
      .where(where)
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset);

    const productIds = rows.map((r) => r.productId);

    // Capa (position=0) por produto — mesma query que /admin/produtos faz.
    let coversByProduct = new Map<string, string>();
    if (productIds.length > 0) {
      const covers = await tx
        .select({
          productId: productImageTable.productId,
          url: productImageTable.url,
        })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, store.id),
            eq(productImageTable.position, 0),
            inArray(productImageTable.productId, productIds),
          ),
        );
      coversByProduct = new Map(covers.map((c) => [c.productId, c.url]));
    }

    // Variantes — payload modesto: cada produto traz só as suas variantes.
    // Em catálogo com 480 combos (40 SKU × 12 cor/tam), página de 30 produtos
    // trás na pior das hipóteses 360 linhas — pequeno o suficiente.
    const variantsByProduct = new Map<
      string,
      Array<{
        id: string;
        name: string;
        stockQuantity: number | null;
        trackStock: boolean;
      }>
    >();
    if (productIds.length > 0) {
      const variants = await tx
        .select({
          id: productVariantTable.id,
          productId: productVariantTable.productId,
          name: productVariantTable.name,
          stockQuantity: productVariantTable.stockQuantity,
          trackStock: productVariantTable.trackStock,
        })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.storeId, store.id),
            eq(productVariantTable.isActive, true),
            inArray(productVariantTable.productId, productIds),
          ),
        )
        .orderBy(productVariantTable.name);
      for (const v of variants) {
        const list = variantsByProduct.get(v.productId) ?? [];
        list.push({
          id: v.id,
          name: v.name,
          stockQuantity: v.stockQuantity,
          trackStock: v.trackStock,
        });
        variantsByProduct.set(v.productId, list);
      }
    }

    const items: StockSnapshotRow[] = rows.map((r) => {
      const variantBreakdown = variantsByProduct.get(r.productId) ?? [];
      // FIX Onda 1.4 (2026-05-24): pra produtos COM variantes rastreadas, o
      // saldo "vive" nas variantes (product.stockQuantity do produto-base
      // costuma ser null ou irrelevante). Antes a tela mostrava sempre o
      // cache do produto-base e produtos com variantes apareciam zerados
      // mesmo com variantes cheias — bug introduzido na primeira versão
      // desta action. Agora: se tem ≥1 variante rastreada, saldo exibido
      // = soma das variantes rastreadas.
      const trackedVariants = variantBreakdown.filter((v) => v.trackStock);
      const controlsStock = r.trackStock || trackedVariants.length > 0;
      let displayStock = controlsStock ? r.stockQuantity : null;
      if (trackedVariants.length > 0) {
        displayStock = trackedVariants.reduce(
          (sum, v) => sum + (v.stockQuantity ?? 0),
          0,
        );
      }
      return {
        productId: r.productId,
        productName: r.productName,
        productSlug: r.productSlug,
        cover: coversByProduct.get(r.productId) ?? null,
        categoryName: r.categoryName,
        trackStock: controlsStock,
        stockQuantity: displayStock,
        minStockQuantity: r.minStockQuantity,
        unit: r.unit,
        variantCount: variantBreakdown.length,
        variantBreakdown,
        basePriceInCents: r.basePriceInCents,
        costPriceInCents: r.costPriceInCents,
        isActive: r.isActive,
      };
    });

    return { items, total };
  });
}

/**
 * Onda 1.4 — counts agregados pra renderizar contadores nas abas de status
 * do snapshot. Uma única query com FILTER (...) por bucket. Igual o padrão
 * usado em /admin/produtos/page.tsx — mantém consistência.
 */
export async function loadStockSnapshotCounts(): Promise<{
  all: number;
  withStock: number;
  zero: number;
  low: number;
  noTracking: number;
}> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return { all: 0, withStock: 0, zero: 0, low: 0, noTracking: 0 };
  }

  return withTenant(store.id, session.user.id, async (tx) => {
    const notDraft = sql`${productTable.slug} not like 'draft-%' and btrim(${productTable.name}) <> ''`;
    const effectiveStock = effectiveStockSql(store.id);
    const controlsStock = controlsStockSql(store.id);
    const trackedAndPositive = sql`${controlsStock} and ${effectiveStock} > 0`;
    const trackedAndZero = sql`${controlsStock} and ${effectiveStock} = 0`;
    const trackedAndLow = sql`${controlsStock} and ${productTable.minStockQuantity} is not null and ${effectiveStock} > 0 and ${effectiveStock} <= ${productTable.minStockQuantity}`;
    const noTracking = sql`NOT ${controlsStock}`;

    const row = await tx
      .select({
        all: sql<number>`count(*) filter (where ${notDraft})::int`,
        withStock: sql<number>`count(*) filter (where ${trackedAndPositive} and ${notDraft})::int`,
        zero: sql<number>`count(*) filter (where ${trackedAndZero} and ${notDraft})::int`,
        low: sql<number>`count(*) filter (where ${trackedAndLow} and ${notDraft})::int`,
        noTracking: sql<number>`count(*) filter (where ${noTracking} and ${notDraft})::int`,
      })
      .from(productTable)
      .where(eq(productTable.storeId, store.id));

    return (
      row[0] ?? { all: 0, withStock: 0, zero: 0, low: 0, noTracking: 0 }
    );
  });
}
