"use server";

/**
 * loadSellersReport — S3.1 do Plano de Endurecimento.
 *
 * Agrega vendas por vendedora no período. Comissão = soma de
 *   item.price_in_cents_snapshot × item.quantity × product.default_commission_bps / 10000
 * pra cada linha de venda do vendedor. Produto sem commission cadastrada
 * → 0 (não infla).
 */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { COUNTABLE_STATUSES } from "@/actions/order/constants";
import {
  orderItemTable,
  orderTable,
  productTable,
  userTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";

export interface SellerRow {
  sellerId: string;
  sellerName: string;
  totalRevenueInCents: number;
  saleCount: number;
  averageTicketInCents: number;
  /** Soma de comissão devida no período. */
  commissionInCents: number;
}

export interface LoadSellersOutput {
  range: { start: Date; end: Date; periodLabel: string };
  rows: SellerRow[];
  totals: {
    totalRevenueInCents: number;
    commissionInCents: number;
    saleCount: number;
  };
}

export async function loadSellersReport(
  filters: Record<string, string | undefined> = {},
): Promise<LoadSellersOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(filters);

  return withTenant(store.id, session.user.id, async (tx) => {
    // Agrega total vendido + count + comissão por sellerId.
    // JOIN com product pra ler default_commission_bps.
    // Filtra orders no período E com status countable (paid/fulfilled/etc).
    const rows = await tx
      .select({
        sellerId: orderTable.sellerId,
        sellerName: userTable.name,
        revenueInCents: sql<number>`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity} - coalesce(${orderItemTable.discountInCents}, 0)), 0)::int`,
        commissionInCents: sql<number>`coalesce(sum(
          (${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity} - coalesce(${orderItemTable.discountInCents}, 0))
          * coalesce(${productTable.defaultCommissionBps}, 0) / 10000
        ), 0)::int`,
        saleCount: sql<number>`count(distinct ${orderTable.id})::int`,
      })
      .from(orderTable)
      .innerJoin(orderItemTable, eq(orderItemTable.orderId, orderTable.id))
      .innerJoin(productTable, eq(productTable.id, orderItemTable.productId))
      .leftJoin(userTable, eq(userTable.id, orderTable.sellerId))
      .where(
        and(
          eq(orderTable.storeId, store.id),
          gte(orderTable.createdAt, range.start),
          lte(orderTable.createdAt, range.end),
          inArray(orderTable.status, COUNTABLE_STATUSES),
          sql`${orderTable.sellerId} IS NOT NULL`,
        ),
      )
      .groupBy(orderTable.sellerId, userTable.name)
      .orderBy(
        sql`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}), 0) DESC`,
      );

    const sellers: SellerRow[] = rows.map((r) => ({
      sellerId: r.sellerId ?? "unknown",
      sellerName: r.sellerName ?? "(sem nome)",
      totalRevenueInCents: r.revenueInCents,
      saleCount: r.saleCount,
      averageTicketInCents:
        r.saleCount > 0 ? Math.round(r.revenueInCents / r.saleCount) : 0,
      commissionInCents: r.commissionInCents,
    }));

    const totals = sellers.reduce(
      (acc, r) => ({
        totalRevenueInCents: acc.totalRevenueInCents + r.totalRevenueInCents,
        commissionInCents: acc.commissionInCents + r.commissionInCents,
        saleCount: acc.saleCount + r.saleCount,
      }),
      { totalRevenueInCents: 0, commissionInCents: 0, saleCount: 0 },
    );

    return { range, rows: sellers, totals };
  });
}
