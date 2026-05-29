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
  orderPaymentTable,
  orderReturnItemTable,
  orderTable,
  productTable,
  userTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  calculateNetProfit,
  type PaymentMethodCategory,
} from "@/lib/pricing/net-profit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { resolveReportRange } from "./range";
import type {
  PaymentMethodFilter,
  SalesReportRow,
  SalesReportSummary,
} from "./types";

const CHANNEL_VALUES = ["whatsapp", "balcao"] as const;
type ChannelFilter = (typeof CHANNEL_VALUES)[number];

const UUID_RE_SINGLE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // R3 Relatórios (2026-05-29) — canal + vendedora completam a tríade
  // pedida no plano (linha 97 lapidando.md): "Filtros: data, canal,
  // vendedora". Canal usa o mesmo nome do URL de /admin/pedidos ("canal").
  // Vendedora idem ("vendedora" — PT-BR varejo, dropdown alimentado pelo
  // filter-options.sellers).
  const channelFilter = parseChannelFilter(input.filters.canal);
  const sellerId = parseSingleUuid(input.filters.vendedora);

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
      channelFilter ? eq(orderTable.channel, channelFilter) : undefined,
      sellerId ? eq(orderTable.sellerId, sellerId) : undefined,
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
        // R3 Relatórios — vendedora atribuída + nome do user
        sellerId: orderTable.sellerId,
        sellerName: userTable.name,
      })
      .from(orderTable)
      .leftJoin(customerTable, eq(customerTable.id, orderTable.customerId))
      .leftJoin(userTable, eq(userTable.id, orderTable.sellerId))
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

    // R3 Relatórios — batch aggregations pra lucro real por venda. Mesma
    // estratégia do /admin/pedidos/page.tsx (R3): 2 queries agregadas
    // por orderId (itens + pagamentos) feeding calculateNetProfit canônico.
    // Sem N+1 mesmo com 5k linhas — `inArray` cobre todas em 1 round-trip
    // cada e a soma é no PG.
    const orderIds = rawRows.map((r) => r.id);
    const costByOrderId = new Map<string, number>();
    const qtyTotalByOrderId = new Map<string, number>();
    const qtyWithCostByOrderId = new Map<string, number>();
    const commissionByOrderId = new Map<string, number>();
    const cardFeeByOrderId = new Map<string, number>();

    if (orderIds.length > 0) {
      const itemAgg = await tx
        .select({
          orderId: orderItemTable.orderId,
          costTotal: sql<number>`coalesce(sum(${orderItemTable.unitCostSnapshotInCents} * ${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
          qtyTotal: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)::int`,
          qtyWithCost: sql<number>`coalesce(sum(${orderItemTable.quantity}) filter (where ${orderItemTable.unitCostSnapshotInCents} is not null), 0)::int`,
          commissionTotal: sql<number>`coalesce(sum(${orderItemTable.commissionSnapshotInCents}) filter (where ${orderItemTable.commissionSnapshotInCents} is not null), 0)::int`,
        })
        .from(orderItemTable)
        .where(inArray(orderItemTable.orderId, orderIds))
        .groupBy(orderItemTable.orderId);
      for (const r of itemAgg) {
        costByOrderId.set(r.orderId, Number(r.costTotal));
        qtyTotalByOrderId.set(r.orderId, Number(r.qtyTotal));
        qtyWithCostByOrderId.set(r.orderId, Number(r.qtyWithCost));
        commissionByOrderId.set(r.orderId, Number(r.commissionTotal));
      }

      const cardFeeAgg = await tx
        .select({
          orderId: orderPaymentTable.orderId,
          cardFeeTotal: sql<number>`coalesce(sum(${orderPaymentTable.cardFeeSnapshotInCents}) filter (where ${orderPaymentTable.cardFeeSnapshotInCents} is not null), 0)::int`,
        })
        .from(orderPaymentTable)
        .where(inArray(orderPaymentTable.orderId, orderIds))
        .groupBy(orderPaymentTable.orderId);
      for (const r of cardFeeAgg) {
        cardFeeByOrderId.set(r.orderId, Number(r.cardFeeTotal));
      }
    }

    const storeFees = {
      cardRealFeeBpsDebit: store.cardRealFeeBpsDebit,
      cardRealFeeBpsCredit1x: store.cardRealFeeBpsCredit1x,
      cardRealFeeBpsCredit2xTo6x: store.cardRealFeeBpsCredit2xTo6x,
      cardRealFeeBpsCredit7xTo12x: store.cardRealFeeBpsCredit7xTo12x,
    };

    const rows: SalesReportRow[] = rawRows.map((r) => {
      const qtyTotal = qtyTotalByOrderId.get(r.id) ?? 0;
      const qtyWithCost = qtyWithCostByOrderId.get(r.id) ?? 0;
      const costInCents = costByOrderId.get(r.id) ?? 0;
      const commissionInCents = commissionByOrderId.get(r.id) ?? 0;
      const cardFeeInCents = cardFeeByOrderId.get(r.id) ?? 0;
      const costCoveragePct =
        qtyTotal === 0 ? 0 : Math.round((qtyWithCost / qtyTotal) * 100);

      // Todas as rows aqui já passaram COUNTABLE_STATUSES no baseCond,
      // então netProfit é sempre calculável. Fallback paymentMethod=other
      // quando snapshot cardFee > 0 (evita helper recalcular sobre o real
      // que já está embutido); fallback pro método legacy quando snapshot=0
      // (venda pré-SQL 82). Mesma lógica de /admin/pedidos/page.tsx.
      const result = calculateNetProfit({
        revenueInCents: r.totalInCents,
        costInCents,
        paymentMethod:
          cardFeeInCents > 0
            ? "other"
            : ((r.paymentMethod ?? "cash") as PaymentMethodCategory),
        installments: 1,
        commissionBps: 0,
        taxBps: 0,
        storeFees,
      });
      const netProfitInCents =
        result.netProfitInCents - cardFeeInCents - commissionInCents;
      const netMarginPct =
        r.totalInCents > 0 ? (netProfitInCents / r.totalInCents) * 100 : 0;

      return {
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
        sellerId: r.sellerId,
        sellerName: r.sellerName,
        netProfitInCents,
        netMarginPct,
        costCoveragePct,
      };
    });

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

function parseChannelFilter(raw: string | undefined): ChannelFilter | null {
  if (!raw || raw === "all") return null;
  return (CHANNEL_VALUES as readonly string[]).includes(raw)
    ? (raw as ChannelFilter)
    : null;
}

function parseSingleUuid(raw: string | undefined): string | null {
  if (!raw || raw === "all") return null;
  return UUID_RE_SINGLE.test(raw) ? raw : null;
}
