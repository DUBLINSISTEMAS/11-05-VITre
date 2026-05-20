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
  productTable,
  productVariantTable,
  stockMovementTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type {
  ListMovementsParams,
  ListMovementsResult,
  StockKpis,
  StockMovementRow,
} from "./types";

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
    return { currentTotal: 0, monthIn: 0, monthOut: 0, monthAdjustments: 0 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return withTenant(store.id, session.user.id, async (tx) => {
    // 1) saldo atual via cache (produto sem variantes + variantes)
    const productTotalRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${productTable.stockQuantity}), 0)`,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          sql`NOT EXISTS (
            SELECT 1
              FROM product_variant pv
             WHERE pv.product_id = ${productTable.id}
               AND pv.store_id = ${store.id}
               AND pv.track_stock = true
          )`,
        ),
      );
    const variantTotalRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${productVariantTable.stockQuantity}), 0)`,
      })
      .from(productVariantTable)
      .where(
        and(
          eq(productVariantTable.storeId, store.id),
          eq(productVariantTable.trackStock, true),
        ),
      );
    const currentTotal =
      Number(productTotalRow[0]?.value ?? 0) +
      Number(variantTotalRow[0]?.value ?? 0);

    // 2) entradas/saídas/ajustes do mês via stock_movement
    const monthWhere = and(
      eq(stockMovementTable.storeId, store.id),
      gte(stockMovementTable.createdAt, monthStart),
      lte(stockMovementTable.createdAt, now),
    );

    const inRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${stockMovementTable.quantityDelta}), 0)`,
      })
      .from(stockMovementTable)
      .where(and(monthWhere, gte(stockMovementTable.quantityDelta, 0)));
    const monthIn = Number(inRow[0]?.value ?? 0);

    const outRow = await tx
      .select({
        value: sql<string>`COALESCE(SUM(${stockMovementTable.quantityDelta}), 0)`,
      })
      .from(stockMovementTable)
      .where(and(monthWhere, lte(stockMovementTable.quantityDelta, -1)));
    const monthOut = Math.abs(Number(outRow[0]?.value ?? 0));

    const adjRow = await tx
      .select({ value: count() })
      .from(stockMovementTable)
      .where(and(monthWhere, eq(stockMovementTable.movementType, "adjustment")));
    const monthAdjustments = adjRow[0]?.value ?? 0;

    return { currentTotal, monthIn, monthOut, monthAdjustments };
  });
}

