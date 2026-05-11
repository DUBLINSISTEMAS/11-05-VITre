import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { ReceiptIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
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

const pedidosSearchSchema = z.object({
  q: searchTextSchema,
  status: enumOrNull(ORDER_STATUS_VALUES),
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
    page,
  } = pedidosSearchSchema.parse(await searchParams);
  const q = rawQ.toUpperCase();

  const conditions: SQL[] = [eq(orderTable.storeId, store.id)];
  if (statusFilter) {
    conditions.push(eq(orderTable.status, statusFilter));
  }
  if (q) {
    // shortCode é unique global; matching exato por loja garante isolamento.
    conditions.push(eq(orderTable.shortCode, q));
  }
  const whereClause = and(...conditions);

  const offset = (page - 1) * PAGE_SIZE;
  const { orders, total } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE — `pg` deprecou queries paralelas no mesmo client tx.
      const orders = await tx.query.orderTable.findMany({
        where: whereClause,
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
          createdAt: true,
        },
      });
      const totalRows = await tx
        .select({ value: count() })
        .from(orderTable)
        .where(whereClause);
      return { orders, total: totalRows[0]?.value ?? 0 };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = q !== "" || statusFilter !== null;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (statusFilter) usp.set("status", statusFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Pedidos"
        subtitle={
          total === 0
            ? hasFilters
              ? "Nenhum pedido bate com os filtros."
              : "Nenhum pedido ainda."
            : `${total} ${total === 1 ? "pedido" : "pedidos"}`
        }
      />

      {/* Suspense boundary obrigatório: OrdersFilters usa useSearchParams().
          Convenção CLAUDE.md #9. */}
      <Suspense fallback={<div className="bg-muted/30 h-10 animate-pulse rounded-md" />}>
        <OrdersFilters />
      </Suspense>

      {orders.length === 0 ? (
        hasFilters ? (
          <NoResults />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <OrdersTable orders={orders} />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <ReceiptIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Sem pedidos por enquanto</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Quando algum cliente fechar uma compra pelo WhatsApp na sua vitrine,
        o pedido aparece aqui com o código curto.
      </p>
    </div>
  );
}

function NoResults() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Nenhum pedido encontrado</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Confira o código ou o status, ou limpe os filtros.
      </p>
    </div>
  );
}
