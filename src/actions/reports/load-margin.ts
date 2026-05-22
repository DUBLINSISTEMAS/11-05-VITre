"use server";

/**
 * loadMarginReport — Sprint 5C.
 *
 * Por produto vendido no período: qty, faturamento, custo total (via
 * unit_cost_snapshot * qty), margem R$ e margem %.
 *
 * Quando o item foi vendido SEM custo cadastrado no momento (o snapshot
 * de cost é NULL), aquela linha não entra na soma de custo — flag
 * `itemsWithCost` < `itemsTotal` sinaliza a precisão parcial.
 *
 * Decisão: margem só é calculada quando 100% dos items vendidos têm
 * custo (itemsWithCost === itemsTotal). Caso contrário, fica NULL e a
 * UI mostra "—" com aviso "X de Y itens com custo cadastrado".
 *
 * Default order: margem absoluta desc (maior contribuição em R$).
 */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { COUNTABLE_STATUSES } from "@/actions/order/constants";
import {
  orderItemTable,
  orderReturnItemTable,
  orderTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type { MarginReportRow } from "./types";

export interface LoadMarginInput {
  filters: Record<string, string | undefined>;
}

export interface LoadMarginOutput {
  range: { start: Date; end: Date; periodLabel: string };
  rows: MarginReportRow[];
  totals: {
    totalRevenueInCents: number;
    totalCostInCents: number;
    totalMarginInCents: number;
    /** Margem % global (apenas linhas com custo 100% cadastrado). */
    overallMarginPercent: number | null;
    productsWithCost: number;
    productsTotal: number;
  };
}

export async function loadMarginReport(
  input: LoadMarginInput,
): Promise<LoadMarginOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(input.filters);

  return withTenant(store.id, session.user.id, async (tx) => {
    const baseCond = and(
      eq(orderTable.storeId, store.id),
      gte(orderTable.createdAt, range.start),
      lte(orderTable.createdAt, range.end),
      inArray(orderTable.status, COUNTABLE_STATUSES),
    );

    const agg = await tx
      .select({
        productId: orderItemTable.productId,
        productName: orderItemTable.productNameSnapshot,
        quantitySold: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)::int`,
        revenueInCents: sql<number>`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}), 0)::int`,
        // Soma custo APENAS dos itens com snapshot preenchido. Itens com
        // unit_cost_snapshot=NULL não entram aqui (CMV ignora).
        totalCostInCents: sql<number>`coalesce(sum(${orderItemTable.unitCostSnapshotInCents} * ${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
        itemsTotal: sql<number>`count(*)::int`,
        itemsWithCost: sql<number>`count(*) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null)::int`,
      })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(baseCond)
      .groupBy(orderItemTable.productId, orderItemTable.productNameSnapshot)
      .orderBy(
        sql`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}) - sum(${orderItemTable.unitCostSnapshotInCents} * ${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0) DESC`,
      )
      .limit(500);

    // Sprint 1.4 — devoluções agregadas por (productId, nameSnapshot).
    // O custo devolvido só conta quando o snapshot existir; quando algum
    // item devolvido não tem custo, retornedCostInCents fica NULL (sinal
    // pra UI ressaltar a precisão parcial daquela linha).
    const returnAgg = await tx
      .select({
        productId: orderItemTable.productId,
        productName: orderItemTable.productNameSnapshot,
        returnedRevenueInCents: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.priceInCentsSnapshot}), 0)::int`,
        returnedCostInCents: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.unitCostSnapshotInCents}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
        returnedItemsWithCost: sql<number>`count(*) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null)::int`,
        returnedItemsTotal: sql<number>`count(*)::int`,
      })
      .from(orderReturnItemTable)
      .innerJoin(
        orderItemTable,
        eq(orderItemTable.id, orderReturnItemTable.orderItemId),
      )
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(baseCond)
      .groupBy(orderItemTable.productId, orderItemTable.productNameSnapshot);

    const keyOf = (p: string | null, n: string) => `${p ?? "null"}|${n}`;
    const returnsByKey = new Map<
      string,
      {
        revenue: number;
        cost: number;
        costFullyCovered: boolean;
      }
    >(
      returnAgg.map((r) => [
        keyOf(r.productId, r.productName),
        {
          revenue: r.returnedRevenueInCents,
          cost: r.returnedCostInCents,
          costFullyCovered:
            r.returnedItemsTotal > 0 &&
            r.returnedItemsWithCost === r.returnedItemsTotal,
        },
      ]),
    );

    const rows: MarginReportRow[] = agg.map((r) => {
      const fullyCovered = r.itemsWithCost === r.itemsTotal && r.itemsTotal > 0;
      const totalCost = fullyCovered ? r.totalCostInCents : null;
      const ret = returnsByKey.get(keyOf(r.productId, r.productName));
      const returnedRevenueInCents = ret?.revenue ?? 0;
      // 3 casos:
      //   - sem devolução: returnedCost = 0 (não polui CMV)
      //   - com devolução E custo das devolvidas 100% cadastrado: returnedCost = ret.cost
      //   - com devolução E falta custo em alguma devolvida: returnedCost = null
      //     (impossível subtrair CMV preciso — margem fica NULL)
      const returnedCostInCents: number | null = !ret
        ? 0
        : ret.costFullyCovered
          ? ret.cost
          : null;

      const netRevenue = r.revenueInCents - returnedRevenueInCents;
      // Margem só computa quando AMBOS lados têm cobertura.
      const canCompute = totalCost !== null && returnedCostInCents !== null;
      const netCost = canCompute
        ? (totalCost ?? 0) - returnedCostInCents
        : null;
      const margin = netCost === null ? null : netRevenue - netCost;
      const marginPct =
        margin === null || netRevenue === 0
          ? null
          : (margin / netRevenue) * 100;

      return {
        productId: r.productId,
        productName: r.productName,
        quantitySold: r.quantitySold,
        revenueInCents: r.revenueInCents,
        totalCostInCents: totalCost,
        returnedRevenueInCents,
        returnedCostInCents,
        marginInCents: margin,
        marginPercent: marginPct,
        itemsWithCost: r.itemsWithCost,
        itemsTotal: r.itemsTotal,
      };
    });

    const productsWithCost = rows.filter(
      (r) => r.marginInCents !== null,
    ).length;
    // Totais agregados — devolução já reflete em margem por linha. Usar
    // valores LÍQUIDOS no rodapé pra bater com soma das linhas.
    const totalRevenue = rows.reduce(
      (acc, r) => acc + r.revenueInCents - r.returnedRevenueInCents,
      0,
    );
    const totalCost = rows.reduce(
      (acc, r) =>
        r.totalCostInCents === null
          ? acc
          : acc + r.totalCostInCents - (r.returnedCostInCents ?? 0),
      0,
    );
    const totalMargin = rows.reduce(
      (acc, r) => acc + (r.marginInCents ?? 0),
      0,
    );
    const revenueWithCost = rows.reduce(
      (acc, r) =>
        r.marginInCents !== null
          ? acc + r.revenueInCents - r.returnedRevenueInCents
          : acc,
      0,
    );
    const overallMarginPercent =
      revenueWithCost === 0 ? null : (totalMargin / revenueWithCost) * 100;

    return {
      range,
      rows,
      totals: {
        totalRevenueInCents: totalRevenue,
        totalCostInCents: totalCost,
        totalMarginInCents: totalMargin,
        overallMarginPercent,
        productsWithCost,
        productsTotal: rows.length,
      },
    };
  });
}
