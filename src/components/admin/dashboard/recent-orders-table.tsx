// Tabela "Pedidos recentes" no dashboard admin (canvas-v1 admin Lote 3).
// Top N pedidos mais recentes (pequena, dispensa paginação). Layout grid
// densa estilo canvas: header monospace uppercase + linhas grid.
import { ArrowRightIcon } from "lucide-react";
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

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Pedidos recentes
        </h2>
        <Link
          href="/admin/pedidos"
          prefetch
          className="hocus:text-primary text-[11.5px] font-medium text-muted-foreground transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido ainda.
        </div>
      ) : (
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/pedidos/${o.id}`}
                prefetch
                className="hocus:bg-accent/40 group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4 sm:px-5"
              >
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold">
                  {o.shortCode}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {o.customerName}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground sm:hidden">
                    {formatBRL(o.totalInCents)} ·{" "}
                    {formatRelativeDate(o.createdAt)}
                  </p>
                </div>
                <span className="hidden font-mono text-[12.5px] tabular-nums text-foreground sm:inline">
                  {formatBRL(o.totalInCents)}
                </span>
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                  {formatRelativeDate(o.createdAt)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <ArrowRightIcon
                    aria-hidden
                    className="text-muted-foreground/60 group-hocus:text-primary size-3.5 transition-colors"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
