"use server";

/**
 * loadTopProductsReport — Sprint 5B.
 *
 * Top produtos vendidos no período. Agrega por productId+nameSnapshot
 * pra preservar histórico (produto deletado continua aparecendo no
 * relatório com o nome que tinha na venda).
 *
 * Default order: receita desc. Filtros via URL: periodo + start/end.
 * Limite hard de 100 produtos — relatório longo demais perde valor.
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
import type { TopProductRow } from "./types";

export interface LoadTopProductsInput {
  filters: Record<string, string | undefined>;
  /** "quantity" ou "revenue" (default). */
  orderBy?: "quantity" | "revenue";
}

export interface LoadTopProductsOutput {
  range: { start: Date; end: Date; periodLabel: string };
  rows: TopProductRow[];
  totals: {
    totalQuantitySold: number;
    totalRevenueInCents: number;
    distinctProducts: number;
  };
}

export async function loadTopProductsReport(
  input: LoadTopProductsInput,
): Promise<LoadTopProductsOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(input.filters);
  const orderByMetric = input.orderBy ?? "revenue";

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
      })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(baseCond)
      .groupBy(orderItemTable.productId, orderItemTable.productNameSnapshot)
      .orderBy(
        orderByMetric === "quantity"
          ? sql`coalesce(sum(${orderItemTable.quantity}), 0) DESC`
          : sql`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}), 0) DESC`,
      )
      .limit(100);

    // Sprint 1.4 — devoluções agregadas por (productId, nameSnapshot)
    // pra alinhar com o GROUP BY da query principal. Usar o
    // priceInCentsSnapshot do order_item original (não o atual do produto)
    // pra preservar precisão histórica.
    const returnAgg = await tx
      .select({
        productId: orderItemTable.productId,
        productName: orderItemTable.productNameSnapshot,
        returnedQuantity: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned}), 0)::int`,
        returnedRevenueInCents: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.priceInCentsSnapshot}), 0)::int`,
      })
      .from(orderReturnItemTable)
      .innerJoin(
        orderItemTable,
        eq(orderItemTable.id, orderReturnItemTable.orderItemId),
      )
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(baseCond)
      .groupBy(orderItemTable.productId, orderItemTable.productNameSnapshot);

    // Key por (productId ?? "null") + "|" + nameSnapshot — productId
    // pode ser null (produto deletado), nesse caso o nome é a chave.
    const keyOf = (p: string | null, n: string) => `${p ?? "null"}|${n}`;
    const returnsByKey = new Map<
      string,
      { quantity: number; revenue: number }
    >(
      returnAgg.map((r) => [
        keyOf(r.productId, r.productName),
        {
          quantity: r.returnedQuantity,
          revenue: r.returnedRevenueInCents,
        },
      ]),
    );

    const rows: TopProductRow[] = agg.map((r) => {
      const ret = returnsByKey.get(keyOf(r.productId, r.productName));
      const returnedQuantity = ret?.quantity ?? 0;
      const returnedRevenueInCents = ret?.revenue ?? 0;
      return {
        productId: r.productId,
        productName: r.productName,
        quantitySold: r.quantitySold,
        revenueInCents: r.revenueInCents,
        returnedQuantity,
        returnedRevenueInCents,
        netQuantity: r.quantitySold - returnedQuantity,
        netRevenueInCents: r.revenueInCents - returnedRevenueInCents,
      };
    });

    const totals = {
      totalQuantitySold: rows.reduce((acc, r) => acc + r.quantitySold, 0),
      totalRevenueInCents: rows.reduce(
        (acc, r) => acc + r.revenueInCents,
        0,
      ),
      distinctProducts: rows.length,
    };

    return { range, rows, totals };
  });
}
