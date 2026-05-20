"use server";

/**
 * loadDreSimple — Sprint 5D.
 *
 * DRE simplificado:
 *   Receita bruta     = SUM(item.price * item.qty)  (preço antes do desconto)
 *   (-) Descontos     = SUM(order.discount)
 *   (+) Acréscimos    = SUM(order.surcharge)
 *   (=) Receita líquida (= SUM(order.total) — invariante de pricing)
 *   (-) CMV           = SUM(item.cost * item.qty) WHERE cost NOT NULL
 *   (=) Lucro bruto
 *
 * Sem despesas operacionais (sem schema de expense). Aviso de
 * simplificação na UI. Sprint futura adiciona expense table.
 *
 * cogsCoveragePercent reporta a precisão do CMV (% itens com custo
 * cadastrado). Se baixo, a lucro bruto é otimista — UI explica.
 */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { type Order, orderItemTable, orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type { DreSimpleSummary } from "./types";

type OrderStatus = Order["status"];

const COUNTABLE_STATUSES: OrderStatus[] = ["confirmed", "fulfilled"];

export interface LoadDreInput {
  filters: Record<string, string | undefined>;
}

export interface LoadDreOutput {
  range: { start: Date; end: Date; periodLabel: string };
  summary: DreSimpleSummary;
}

export async function loadDreSimple(
  input: LoadDreInput,
): Promise<LoadDreOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(input.filters);

  return withTenant(store.id, session.user.id, async (tx) => {
    const orderCond = and(
      eq(orderTable.storeId, store.id),
      gte(orderTable.createdAt, range.start),
      lte(orderTable.createdAt, range.end),
      inArray(orderTable.status, COUNTABLE_STATUSES),
    );

    // 1) Agregados em order: receita líquida, descontos, acréscimos, count.
    const [orderAgg] = await tx
      .select({
        netRevenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
        discounts: sql<number>`coalesce(sum(${orderTable.discountInCents}), 0)::int`,
        surcharges: sql<number>`coalesce(sum(${orderTable.surchargeInCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(orderTable)
      .where(orderCond);

    // 2) Agregados em order_item (JOIN com order pro mesmo filtro).
    const [itemAgg] = await tx
      .select({
        grossRevenue: sql<number>`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}), 0)::int`,
        cogs: sql<number>`coalesce(sum(${orderItemTable.unitCostSnapshotInCents} * ${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
        totalItems: sql<number>`count(*)::int`,
        itemsWithCost: sql<number>`count(*) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null)::int`,
      })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(orderCond);

    const grossRevenue = itemAgg?.grossRevenue ?? 0;
    const discounts = orderAgg?.discounts ?? 0;
    const surcharges = orderAgg?.surcharges ?? 0;
    const netRevenue = orderAgg?.netRevenue ?? 0;
    const cogs = itemAgg?.cogs ?? 0;
    const grossProfit = netRevenue - cogs;
    const totalItems = itemAgg?.totalItems ?? 0;
    const itemsWithCost = itemAgg?.itemsWithCost ?? 0;
    const coverage =
      totalItems === 0 ? 100 : Math.round((itemsWithCost / totalItems) * 100);

    return {
      range,
      summary: {
        grossRevenueInCents: grossRevenue,
        discountsInCents: discounts,
        surchargesInCents: surcharges,
        netRevenueInCents: netRevenue,
        cogsInCents: cogs,
        grossProfitInCents: grossProfit,
        cogsCoveragePercent: coverage,
        totalOrderCount: orderAgg?.count ?? 0,
      },
    };
  });
}
