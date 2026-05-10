import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { ReceiptIcon, SearchXIcon } from "lucide-react";

import { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrdersFilters } from "@/components/admin/orders-filters";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Pagination } from "@/components/common/pagination";
import { orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

interface PedidosPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pedidos page sem loja");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim().toUpperCase();
  const statusFilter = params.status ?? null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const conditions: SQL[] = [eq(orderTable.storeId, store.id)];
  if (
    statusFilter &&
    (ORDER_STATUS_VALUES as readonly string[]).includes(statusFilter)
  ) {
    conditions.push(
      eq(
        orderTable.status,
        statusFilter as (typeof ORDER_STATUS_VALUES)[number],
      ),
    );
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
      const [orders, totalRows] = await Promise.all([
        tx.query.orderTable.findMany({
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
        }),
        tx.select({ value: count() }).from(orderTable).where(whereClause),
      ]);
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

      <OrdersFilters />

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
        Quando algum cliente fechar uma compra pelo WhatsApp na sua loja,
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
