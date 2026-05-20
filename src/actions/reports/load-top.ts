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

import { type Order, orderItemTable, orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type { TopProductRow } from "./types";

type OrderStatus = Order["status"];

const COUNTABLE_STATUSES: OrderStatus[] = ["confirmed", "fulfilled"];

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

    const rows: TopProductRow[] = agg.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      quantitySold: r.quantitySold,
      revenueInCents: r.revenueInCents,
    }));

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
