// Tabela "Pedidos recentes" no dashboard admin (canvas-v1 admin Lote 3).
// Top N pedidos mais recentes — DataGrid 6-col mono no desktop, cards
// compactos no mobile. Padrão fiel ao canvas (linhas 252-277): cabeçalho
// monospace uppercase, sem avatar/pill colorido, status com dot+texto.
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

export interface RecentOrderRow {
  id: string;
  shortCode: string;
  customerName: string;
  totalInCents: number;
  status: (typeof ORDER_STATUS_VALUES)[number];
  createdAt: Date;
}

export interface RecentOrdersTableProps {
  orders: ReadonlyArray<RecentOrderRow>;
}

const GRID_COLS =
  "grid-cols-[110px_minmax(0,1.4fr)_minmax(0,120px)_minmax(0,120px)_120px_24px]";

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-foreground text-[13.5px] font-semibold tracking-tight">
          Pedidos recentes
        </h2>
        <Link
          href="/admin/pedidos"
          prefetch
          className="text-muted-foreground hocus:text-primary text-[11.5px] font-medium transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          Nenhum pedido ainda.
        </div>
      ) : (
        <>
          {/* Desktop: DataGrid 6 colunas */}
          <div
            role="rowgroup"
            className={`text-eyebrow bg-muted/50 hidden ${GRID_COLS} items-center gap-3 border-b px-4 py-2.5 sm:grid sm:px-5`}
          >
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Total</span>
            <span>Quando</span>
            <span>Status</span>
            <span aria-hidden />
          </div>

          <ul className="divide-border divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                {/* Desktop */}
                <Link
                  href={`/admin/pedidos/${o.id}`}
                  prefetch
                  className={`hocus:bg-accent/40 group hidden ${GRID_COLS} items-center gap-3 px-4 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid sm:px-5`}
                >
                  <span className="font-mono text-[13px] font-medium tabular-nums">
                    {o.shortCode}
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    {o.customerName}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatBRL(o.totalInCents)}
                  </span>
                  <span className="text-muted-foreground font-mono text-[12px]">
                    {formatRelativeDate(o.createdAt)}
                  </span>
                  <span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                  <span
                    aria-hidden
                    className="text-muted-foreground/60 group-hover:text-foreground flex justify-end transition-colors"
                  >
                    <ChevronRightIcon className="size-3.5" />
                  </span>
                </Link>

                {/* Mobile: card compacto */}
                <Link
                  href={`/admin/pedidos/${o.id}`}
                  prefetch
                  className="hocus:bg-accent/40 group flex items-center gap-3 px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:hidden"
                >
                  <span className="font-mono text-[13px] font-semibold tabular-nums">
                    {o.shortCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {o.customerName}
                    </p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      <span className="tabular-nums">
                        {formatBRL(o.totalInCents)}
                      </span>{" "}
                      · {formatRelativeDate(o.createdAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
