"use server";

/**
 * loadSalesReport — Sprint 5A.
 *
 * Lista venda-a-venda do período + agregados (count, receita, ticket
 * médio, por canal, por método). Usado em /admin/relatorios/vendas.
 *
 * Filtra orders com status final positivo (`confirmed`, `fulfilled`,
 * `delivered`) — exclui canceled / expired / quote / draft. Mesma
 * convenção do loadFullReport pra não criar dois "totais" diferentes.
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { COUNTABLE_STATUSES } from "@/actions/order/constants";
import {
  customerTable,
  orderItemTable,
  orderReturnItemTable,
  orderTable,
  productTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type {
  PaymentMethodFilter,
  SalesReportRow,
  SalesReportSummary,
} from "./types";

export interface LoadSalesReportInput {
  /** Filtros URL: periodo (7/30/90/custom), start, end, paymentMethod. */
  filters: Record<string, string | undefined>;
}

export interface LoadSalesReportOutput {
  range: { start: Date; end: Date; periodLabel: string };
  rows: SalesReportRow[];
  summary: SalesReportSummary;
}

export async function loadSalesReport(
  input: LoadSalesReportInput,
): Promise<LoadSalesReportOutput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const range = resolveReportRange(input.filters);
  const paymentFilter = parsePaymentFilter(input.filters.paymentMethod);
  // Sprint 4.2 — filtros opcionais por categoria/marca. Multi-select via
  // CSV na URL ("?categoryIds=a,b,c"). Filtro INCLUSIVO: venda aparece
  // se TIVER ao menos um order_item de produto na categoria/marca
  // selecionada (total exibido = total da venda inteira, preserva
  // consistência com order.totalInCents).
  const categoryIds = parseUuidCsv(input.filters.categoryIds);
  const brandIds = parseUuidCsv(input.filters.brandIds);

  return withTenant(store.id, session.user.id, async (tx) => {
    const productFilter =
      categoryIds.length > 0 || brandIds.length > 0
        ? sql`EXISTS (
            SELECT 1 FROM ${orderItemTable} oi
            INNER JOIN ${productTable} p ON p.id = oi.product_id
            WHERE oi.order_id = ${orderTable.id}
              AND p.store_id = ${orderTable.storeId}
              ${categoryIds.length > 0 ? sql`AND p.category_id IN (${sql.join(categoryIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
              ${brandIds.length > 0 ? sql`AND p.brand_id IN (${sql.join(brandIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
          )`
        : undefined;

    const baseCond = and(
      eq(orderTable.storeId, store.id),
      gte(orderTable.createdAt, range.start),
      lte(orderTable.createdAt, range.end),
      inArray(orderTable.status, COUNTABLE_STATUSES),
      paymentFilter && paymentFilter !== "all"
        ? eq(orderTable.paymentMethod, paymentFilter)
        : undefined,
      productFilter,
    );

    const rawRows = await tx
      .select({
        id: orderTable.id,
        shortCode: orderTable.shortCode,
        createdAt: orderTable.createdAt,
        channel: orderTable.channel,
        status: orderTable.status,
        paymentMethod: orderTable.paymentMethod,
        totalInCents: orderTable.totalInCents,
        customerId: orderTable.customerId,
        customerName: customerTable.name,
        snapshotName: orderTable.customerName,
      })
      .from(orderTable)
      .leftJoin(customerTable, eq(customerTable.id, orderTable.customerId))
      .where(baseCond)
      .orderBy(desc(orderTable.createdAt))
      .limit(5000); // hard cap defensivo: rel. de 5k linhas já é absurdo

    // Sprint 1.4 — agregado de devolução por order. Subtrair do total
    // pra mostrar "venda líquida" e popular badge "R$X devolvidos".
    const returnAgg = await tx
      .select({
        orderId: orderItemTable.orderId,
        returnedInCents: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned} * ${orderItemTable.priceInCentsSnapshot}), 0)::int`,
      })
      .from(orderReturnItemTable)
      .innerJoin(
        orderItemTable,
        eq(orderItemTable.id, orderReturnItemTable.orderItemId),
      )
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(baseCond)
      .groupBy(orderItemTable.orderId);

    const returnedByOrder = new Map<string, number>(
      returnAgg.map((r) => [r.orderId, r.returnedInCents]),
    );

    const rows: SalesReportRow[] = rawRows.map((r) => ({
      id: r.id,
      shortCode: r.shortCode,
      createdAt: r.createdAt,
      channel: r.channel,
      status: r.status,
      paymentMethod: r.paymentMethod,
      totalInCents: r.totalInCents,
      returnedInCents: returnedByOrder.get(r.id) ?? 0,
      customerName:
        r.customerName ?? r.snapshotName ?? "Venda balcão (anônimo)",
    }));

    // Summary agregado direto no DB (separado pra não pagar processamento
    // em JS quando a tabela tiver 5k linhas).
    const [agg] = await tx
      .select({
        totalCount: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(baseCond);

    const byChannel = await tx
      .select({
        channel: orderTable.channel,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(baseCond)
      .groupBy(orderTable.channel);

    const byMethod = await tx
      .select({
        method: orderTable.paymentMethod,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orderTable.totalInCents}), 0)::int`,
      })
      .from(orderTable)
      .where(baseCond)
      .groupBy(orderTable.paymentMethod);

    const totalCount = agg?.totalCount ?? 0;
    const totalRevenue = agg?.totalRevenue ?? 0;
    // Sprint 1.4 — soma do que voltou em devolução nas vendas listadas.
    const totalReturned = rows.reduce((acc, r) => acc + r.returnedInCents, 0);
    const netRevenue = totalRevenue - totalReturned;

    return {
      range,
      rows,
      summary: {
        totalCount,
        totalRevenueInCents: totalRevenue,
        totalReturnedInCents: totalReturned,
        netRevenueInCents: netRevenue,
        // Ticket médio segue baseado em receita BRUTA — devolução não
        // muda quanto entrou no caixa originalmente. Aliás, lojistas
        // medem "quanto o cliente comprou", não "quanto ficou".
        averageTicketInCents:
          totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
        byChannel: byChannel.map((b) => ({
          channel: b.channel,
          count: b.count,
          revenueInCents: b.revenue,
        })),
        byPaymentMethod: byMethod.map((b) => ({
          method: b.method,
          count: b.count,
          revenueInCents: b.revenue,
        })),
      },
    };
  });
}

function parsePaymentFilter(
  raw: string | undefined,
): PaymentMethodFilter | null {
  if (!raw) return null;
  if (raw === "all") return "all";
  if (["cash", "pix", "debit", "credit", "other"].includes(raw)) {
    return raw as PaymentMethodFilter;
  }
  return null;
}

/**
 * Sprint 4.2 — converte CSV de IDs da URL em array de UUIDs válidos.
 * Filtra entradas vazias e UUIDs mal-formados (defesa em profundidade —
 * Zod no caller deveria pegar, mas SQL.raw nunca recebe input não
 * sanitizado).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseUuidCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}
