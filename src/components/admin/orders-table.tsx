// Lista de pedidos do admin (canvas-v1 admin Lote 3 — Onda 6).
//
// - Desktop (lg+): tabela densa canvas-style. 6 colunas:
//     # (shortCode mono) · Cliente · Total · Data · Status · →
//   Header monospace uppercase 10.5px. Cada <tr> é um Link clicável inteiro.
// - Mobile (<lg): mantém divide-y de cards visuais (UX touch atual).
//
// Sem state local — pedidos não têm bulk actions. Server component puro.
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export interface OrderTableRow {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string;
  totalInCents: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface OrdersTableProps {
  orders: ReadonlyArray<OrderTableRow>;
}

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <>
      {/* Desktop: tabela densa */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-muted/50 grid grid-cols-[120px_minmax(0,1.4fr)_minmax(0,140px)_minmax(0,140px)_120px_40px] items-center gap-4 border-b px-4 py-3"
        >
          <span>#</span>
          <span>Cliente</span>
          <span>Total</span>
          <span>Data</span>
          <span>Status</span>
          <span aria-hidden />
        </div>

        <ul className="divide-border divide-y">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/pedidos/${o.id}`}
                prefetch
                className="hocus:bg-accent/40 group grid grid-cols-[120px_minmax(0,1.4fr)_minmax(0,140px)_minmax(0,140px)_120px_40px] items-center gap-4 px-4 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
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
                <span className="text-muted-foreground text-[13px]">
                  {formatRelativeDate(o.createdAt)}
                </span>
                <span>
                  <OrderStatusBadge status={o.status} />
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground/60 group-hover:text-foreground flex justify-end transition-colors"
                >
                  <ChevronRightIcon className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile: lista de cards (UX touch) */}
      <ul className="divide-border divide-y rounded-xl border lg:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/pedidos/${o.id}`}
              prefetch
              className="hocus:bg-accent/40 group flex items-center gap-3 p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:p-4"
            >
              <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold tabular-nums sm:size-14 sm:text-base">
                {o.shortCode}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium sm:text-base">
                  {o.customerName}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  <span className="font-mono tabular-nums">
                    {formatBRL(o.totalInCents)}
                  </span>{" "}
                  · {formatRelativeDate(o.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
                <OrderStatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
