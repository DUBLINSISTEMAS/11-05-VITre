"use server";

/**
 * loadDreSimple — Sprint 5D + Sprint 1.4 (2026-05-22).
 *
 * DRE simplificado:
 *   Receita bruta     = SUM(item.price * item.qty)  (preço antes do desconto)
 *   (-) Descontos     = SUM(order.discount)
 *   (+) Acréscimos    = SUM(order.surcharge)
 *   (-) Devoluções    = SUM(order_return_item.quantity * item.price_snapshot)   [Sprint 1.4]
 *   (=) Receita líquida (= SUM(order.total) - devoluções)
 *   (-) CMV efetivo   = SUM(item.cost * item.qty) - SUM(devolvido.cost * qty)
 *                       (CMV das vendidas menos CMV das devolvidas)
 *   (=) Lucro bruto
 *
 * Vinculação por período: devoluções descontam no período da VENDA
 * original (não no período em que a devolução foi registrada). Mantém
 * consistência histórica — relatório de janeiro mostra "vendi R$X,
 * devolveram R$Y" mesmo se devolução foi em março. Trade-off: relatório
 * de período passado pode mudar quando alguém devolve.
 *
 * Sem despesas operacionais (sem schema de expense). Aviso de
 * simplificação na UI. Sprint futura adiciona expense table.
 *
 * cogsCoveragePercent reporta a precisão do CMV (% itens com custo
 * cadastrado). Se baixo, a lucro bruto é otimista — UI explica.
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
import type { DreSimpleSummary } from "./types";

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

    // 1) Agregados em order. Sprint 2.3 separa shipping (frete) de
    //    surcharge (taxas). Pedidos pré-SQL-65 têm shipping=0; novos
    //    pedidos podem ter valor quando UI for migrada.
    const [orderAgg] = await tx
      .select({
        netRevenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
        discounts: sql<number>`coalesce(sum(${orderTable.discountInCents}), 0)::int`,
        surcharges: sql<number>`coalesce(sum(${orderTable.surchargeInCents}), 0)::int`,
        shipping: sql<number>`coalesce(sum(${orderTable.shippingInCents}), 0)::int`,
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

    // 3) Sprint 1.4 — devoluções vinculadas a vendas DO PERÍODO. JOIN
    //    em cascata: order_return_item → order_item → order → filtro.
    //    revenue devolvida = qty_returned × price_snapshot do item original.
    //    cogs devolvido   = qty_returned × cost_snapshot do item original.
    const [returnAgg] = await tx
      .select({
        returnedRevenue: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.priceInCentsSnapshot}), 0)::int`,
        returnedCogs: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.unitCostSnapshotInCents}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
      })
      .from(orderReturnItemTable)
      .innerJoin(
        orderItemTable,
        eq(orderItemTable.id, orderReturnItemTable.orderItemId),
      )
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(orderCond);

    const grossRevenue = itemAgg?.grossRevenue ?? 0;
    const discounts = orderAgg?.discounts ?? 0;
    const surcharges = orderAgg?.surcharges ?? 0;
    const shipping = orderAgg?.shipping ?? 0;
    const returnedRevenue = returnAgg?.returnedRevenue ?? 0;
    const returnedCogs = returnAgg?.returnedCogs ?? 0;
    // Sprint 2.3 — invariante de pricing:
    //   order.total = grossRevenue - discount + surcharge + shipping
    // Pra netRevenue (receita do lojista), removemos shipping (repasse
    // que sai pra transportadora) e devoluções.
    const netRevenue =
      (orderAgg?.netRevenue ?? 0) - shipping - returnedRevenue;
    const cogs = (itemAgg?.cogs ?? 0) - returnedCogs;
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
        shippingInCents: shipping,
        returnedRevenueInCents: returnedRevenue,
        netRevenueInCents: netRevenue,
        cogsInCents: cogs,
        returnedCogsInCents: returnedCogs,
        grossProfitInCents: grossProfit,
        cogsCoveragePercent: coverage,
        totalOrderCount: orderAgg?.count ?? 0,
      },
    };
  });
}
