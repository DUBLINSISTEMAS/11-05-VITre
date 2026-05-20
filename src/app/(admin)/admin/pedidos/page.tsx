import { and, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { PlusIcon, ReceiptIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import {
  type OrdersStatusCounts,
  OrdersStatusTabs,
} from "@/components/admin/orders-status-tabs";
import { OrdersTable } from "@/components/admin/orders-table";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { Pagination } from "@/components/common/pagination";
import { orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import {
  enumOrNull,
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

const ORDER_CHANNEL_VALUES = ["whatsapp", "balcao"] as const;

const pedidosSearchSchema = z.object({
  q: searchTextSchema,
  status: enumOrNull(ORDER_STATUS_VALUES),
  canal: enumOrNull(ORDER_CHANNEL_VALUES),
  page: pageNumberSchema,
});

interface PedidosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pedidos page sem loja");
  }

  const {
    q: rawQ,
    status: statusFilter,
    canal: channelFilter,
    page,
  } = pedidosSearchSchema.parse(await searchParams);
  const q = rawQ.trim();

  // Condições "globais" — aplicadas em counts (sem status) e listing (com status)
  const baseConditions: SQL[] = [eq(orderTable.storeId, store.id)];
  if (channelFilter) {
    baseConditions.push(eq(orderTable.channel, channelFilter));
  }
  if (q) {
    // Auditoria I3 (2026-05-12): prefixo case-insensitive no shortCode OU
    // substring no nome. Escape de wildcards (`%` / `_`).
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    const condition = or(
      ilike(orderTable.shortCode, `${safeQ}%`),
      ilike(orderTable.customerName, `%${safeQ}%`),
    );
    if (condition) baseConditions.push(condition);
  }

  // Listing aplica status filter por cima
  const listConditions = statusFilter
    ? [...baseConditions, eq(orderTable.status, statusFilter)]
    : baseConditions;

  const whereList = and(...listConditions);
  const whereCounts = and(...baseConditions);

  const offset = (page - 1) * PAGE_SIZE;

  const { orders, total, statusCounts } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE — `pg` deprecou queries paralelas no mesmo client tx.
      const orders = await tx.query.orderTable.findMany({
        where: whereList,
        orderBy: [desc(orderTable.createdAt)],
        limit: PAGE_SIZE,
        offset,
        columns: {
          id: true,
          shortCode: true,
          customerName: true,
          customerPhone: true,
          totalInCents: true,
          status: true,
          channel: true,
          paymentMethod: true,
          createdAt: true,
        },
      });
      const totalRows = await tx
        .select({ value: count() })
        .from(orderTable)
        .where(whereList);

      // Counts agregados por status — 1 query × 5 buckets via FILTER.
      // Respeita q + canal mas NÃO status (status é o eixo das tabs).
      const statusCountsRow = await tx
        .select({
          total: sql<number>`count(*)::int`,
          quote: sql<number>`count(*) filter (where ${orderTable.status} = 'quote')::int`,
          awaiting_whatsapp: sql<number>`count(*) filter (where ${orderTable.status} = 'awaiting_whatsapp')::int`,
          confirmed: sql<number>`count(*) filter (where ${orderTable.status} = 'confirmed')::int`,
          fulfilled: sql<number>`count(*) filter (where ${orderTable.status} = 'fulfilled')::int`,
          canceled: sql<number>`count(*) filter (where ${orderTable.status} = 'canceled')::int`,
        })
        .from(orderTable)
        .where(whereCounts);

      return {
        orders,
        total: totalRows[0]?.value ?? 0,
        statusCounts: statusCountsRow[0] ?? {
          total: 0,
          quote: 0,
          awaiting_whatsapp: 0,
          confirmed: 0,
          fulfilled: 0,
          canceled: 0,
        },
      };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    q !== "" || statusFilter !== null || channelFilter !== null;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (statusFilter) usp.set("status", statusFilter);
    if (channelFilter) usp.set("canal", channelFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  const counts: OrdersStatusCounts = statusCounts;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* H1 + CTA Dublin v3 (substitui AdminPageHeader) */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-1">
          Vendas
        </h1>
        <Link href="/admin/pdv" className="b3-btn b3-btn--cta" prefetch>
          <PlusIcon size={14} aria-hidden /> Nova venda
        </Link>
      </div>

      {orders.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card overflow-hidden">
          {/* Tabs por status */}
          <Suspense
            fallback={<div className="bg-bg-app h-12 animate-pulse" />}
          >
            <OrdersStatusTabs counts={counts} />
          </Suspense>

          {/* Toolbar: busca + filtros + counter */}
          <Suspense
            fallback={<div className="bg-bg-app h-14 animate-pulse" />}
          >
            <OrdersToolbar
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
            />
          </Suspense>

          {/* Tabela ou estado "sem resultados pra filtro" */}
          {orders.length === 0 ? <NoResults /> : <OrdersTable orders={orders} />}

          {orders.length > 0 ? (
            <div className="border-t border-line p-3">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildHref={buildHref}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <ReceiptIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Sem vendas por enquanto
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Quando algum cliente fechar uma compra pelo WhatsApp na sua vitrine,
        a venda aparece aqui com o código curto.
      </p>
    </div>
  );
}

function NoResults() {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Nenhuma venda encontrada
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira o código ou o status, ou limpe os filtros.
      </p>
    </div>
  );
}
