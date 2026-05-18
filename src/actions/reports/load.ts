"use server";

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import {
  customerTable,
  leadTable,
  orderItemTable,
  orderTable,
  productTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type ReportPeriod = "7" | "30" | "90" | "custom";

export type ReportRange = {
  start: Date;
  end: Date;
  periodLabel: string;
};

const filterSchema = z.object({
  periodo: z.enum(["7", "30", "90", "custom"]).catch("30"),
  start: z.string().nullish(),
  end: z.string().nullish(),
});

export type ReportFilters = z.input<typeof filterSchema>;

export function resolveRange(rawFilters: Record<string, string | undefined>): ReportRange {
  const parsed = filterSchema.parse(rawFilters);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start = new Date();
  let label = "últimos 30 dias";

  if (parsed.periodo === "custom" && parsed.start && parsed.end) {
    start = new Date(parsed.start);
    const customEnd = new Date(parsed.end);
    customEnd.setHours(23, 59, 59, 999);
    label = `${parsed.start} → ${parsed.end}`;
    return { start, end: customEnd, periodLabel: label };
  }
  const days = parsed.periodo === "7" ? 7 : parsed.periodo === "90" ? 90 : 30;
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  label = `últimos ${days} dias`;
  return { start, end, periodLabel: label };
}

export type SalesReport = {
  totalSales: number;
  totalRevenueInCents: number;
  averageTicketInCents: number;
  byChannel: { channel: "whatsapp" | "balcao"; count: number; revenueInCents: number }[];
  byPaymentMethod: {
    method: string | null;
    count: number;
    revenueInCents: number;
  }[];
};

export type ProductsReport = {
  topByQuantity: {
    productId: string | null;
    name: string;
    quantity: number;
    revenueInCents: number;
  }[];
  topByRevenue: {
    productId: string | null;
    name: string;
    quantity: number;
    revenueInCents: number;
  }[];
};

export type CustomersReport = {
  topCustomers: {
    customerId: string;
    name: string;
    orderCount: number;
    totalSpentInCents: number;
  }[];
  newCustomers: number;
};

export type LeadsReport = {
  totalLeads: number;
  byStatus: { status: "new" | "contacted" | "converted" | "lost"; count: number }[];
  conversionRate: number; // 0..1
};

export type StockReport = {
  zeroStock: { id: string; name: string }[];
  lowStock: { id: string; name: string; quantity: number }[];
};

export type FullReport = {
  range: ReportRange;
  sales: SalesReport;
  products: ProductsReport;
  customers: CustomersReport;
  leads: LeadsReport;
  stock: StockReport;
};

export async function loadFullReport(
  rawFilters: Record<string, string | undefined>,
): Promise<FullReport | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveRange(rawFilters);

  return withTenant(store.id, session.user.id, async (tx) => {
    const periodCond = and(
      eq(orderTable.storeId, store.id),
      gte(orderTable.createdAt, range.start),
      lte(orderTable.createdAt, range.end),
      sql`${orderTable.status} <> 'canceled'`,
      sql`${orderTable.status} <> 'expired'`,
    );

    // 1. Sales totals + by channel + by payment
    const salesAgg = await tx
      .select({
        totalSales: count(),
        totalRevenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(periodCond);

    const byChannel = await tx
      .select({
        channel: orderTable.channel,
        count: count(),
        revenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(periodCond)
      .groupBy(orderTable.channel);

    const byPayment = await tx
      .select({
        method: orderTable.paymentMethod,
        count: count(),
        revenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(periodCond)
      .groupBy(orderTable.paymentMethod);

    const totalSales = salesAgg[0]?.totalSales ?? 0;
    const totalRevenueInCents = salesAgg[0]?.totalRevenue ?? 0;
    const sales: SalesReport = {
      totalSales,
      totalRevenueInCents,
      averageTicketInCents:
        totalSales > 0 ? Math.round(totalRevenueInCents / totalSales) : 0,
      byChannel: byChannel.map((b) => ({
        channel: b.channel,
        count: b.count,
        revenueInCents: b.revenue,
      })),
      byPaymentMethod: byPayment.map((b) => ({
        method: b.method,
        count: b.count,
        revenueInCents: b.revenue,
      })),
    };

    // 2. Top products (by quantity / by revenue)
    const productAgg = await tx
      .select({
        productId: orderItemTable.productId,
        name: orderItemTable.productNameSnapshot,
        quantity: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)::int`,
        revenue: sql<number>`coalesce(sum(${orderItemTable.priceInCentsSnapshot} * ${orderItemTable.quantity}), 0)::int`,
      })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(periodCond)
      .groupBy(orderItemTable.productId, orderItemTable.productNameSnapshot);

    const topByQuantity = [...productAgg]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((p) => ({
        productId: p.productId,
        name: p.name,
        quantity: p.quantity,
        revenueInCents: p.revenue,
      }));
    const topByRevenue = [...productAgg]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        productId: p.productId,
        name: p.name,
        quantity: p.quantity,
        revenueInCents: p.revenue,
      }));
    const products: ProductsReport = { topByQuantity, topByRevenue };

    // 3. Top customers
    const customerAgg = await tx
      .select({
        customerId: orderTable.customerId,
        name: customerTable.name,
        orderCount: count(),
        totalSpent: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .innerJoin(customerTable, eq(customerTable.id, orderTable.customerId))
      .where(periodCond)
      .groupBy(orderTable.customerId, customerTable.name)
      .orderBy(desc(sql`coalesce(sum(${orderTable.totalInCents}), 0)`))
      .limit(10);

    const newCustomers = await tx
      .select({ c: count() })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.storeId, store.id),
          gte(customerTable.createdAt, range.start),
          lte(customerTable.createdAt, range.end),
        ),
      );

    const customers: CustomersReport = {
      topCustomers: customerAgg
        .filter((c) => c.customerId !== null)
        .map((c) => ({
          customerId: c.customerId!,
          name: c.name,
          orderCount: c.orderCount,
          totalSpentInCents: c.totalSpent,
        })),
      newCustomers: newCustomers[0]?.c ?? 0,
    };

    // 4. Leads
    const leadsAgg = await tx
      .select({
        status: leadTable.status,
        count: count(),
      })
      .from(leadTable)
      .where(
        and(
          eq(leadTable.storeId, store.id),
          gte(leadTable.createdAt, range.start),
          lte(leadTable.createdAt, range.end),
        ),
      )
      .groupBy(leadTable.status);

    const totalLeads = leadsAgg.reduce((acc, l) => acc + l.count, 0);
    const converted = leadsAgg.find((l) => l.status === "converted")?.count ?? 0;
    const leads: LeadsReport = {
      totalLeads,
      byStatus: leadsAgg,
      conversionRate: totalLeads > 0 ? converted / totalLeads : 0,
    };

    // 5. Stock (snapshot atual, não filtrado por período — sempre "agora")
    const stockRows = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        quantity: productTable.stockQuantity,
        trackStock: productTable.trackStock,
        isActive: productTable.isActive,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          eq(productTable.isActive, true),
        ),
      );

    const stock: StockReport = {
      zeroStock: stockRows
        .filter((s) => (s.quantity ?? 0) <= 0)
        .map((s) => ({ id: s.id, name: s.name })),
      lowStock: stockRows
        .filter((s) => (s.quantity ?? 0) > 0 && (s.quantity ?? 0) <= 3)
        .map((s) => ({ id: s.id, name: s.name, quantity: s.quantity ?? 0 })),
    };

    return { range, sales, products, customers, leads, stock };
  });
}
