"use client";

// Lista de pedidos do admin (Onda 4 do pacote master 2026-05-12).
//
// Mudanças vs canvas-v1 anterior:
//  - Cada linha é um <button> que abre OrderDetailDialog (não navega mais
//    pra /admin/pedidos/[id], rota deletada).
//  - Densidade aumentada: padding reduzido, mobile virou row densa em
//    vez de card grande.
//  - Status badge mantém amarelo (aguardando) + verde (confirmado) — cores
//    aplicadas via STATUS_CLASSES no OrderStatusBadge.

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderDetailDialog } from "@/components/admin/order-detail-dialog";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export interface OrderTableRow {
  id: string;
  shortCode: string;
  customerName: string;
  /** NULL para venda balcão walk-in (Fase 5 — ADR-0016). */
  customerPhone: string | null;
  totalInCents: number;
  status: OrderStatus;
  createdAt: Date;
  /** Fase 5: 'whatsapp' (legado/storefront) ou 'balcao' (PDV). */
  channel?: "whatsapp" | "balcao";
}

export interface OrdersTableProps {
  orders: ReadonlyArray<OrderTableRow>;
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <>
      {/* Desktop: tabela densa */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-muted/50 grid grid-cols-[110px_minmax(0,1.4fr)_minmax(0,130px)_minmax(0,130px)_120px_32px] items-center gap-4 border-b px-4 py-2.5"
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
              <button
                type="button"
                onClick={() => setOpenOrderId(o.id)}
                className="hocus:bg-accent/40 group grid w-full grid-cols-[110px_minmax(0,1.4fr)_minmax(0,130px)_minmax(0,130px)_120px_32px] items-center gap-4 px-4 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="font-mono text-[12.5px] font-medium tabular-nums">
                  {o.shortCode}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                  {o.customerName}
                  {o.channel === "balcao" ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-900">
                      Balcão
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {formatBRL(o.totalInCents)}
                </span>
                <span className="text-muted-foreground text-[12.5px]">
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
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile: rows compactas (4.1 — densidade) */}
      <ul className="divide-border divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setOpenOrderId(o.id)}
              className="hocus:bg-accent/40 group flex w-full items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold tabular-nums">
                {o.shortCode}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium leading-tight">
                  {o.customerName}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-[11.5px] leading-tight">
                  <span className="font-mono tabular-nums">
                    {formatBRL(o.totalInCents)}
                  </span>{" "}
                  · {formatRelativeDate(o.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
                <OrderStatusBadge status={o.status} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      <OrderDetailDialog
        orderId={openOrderId}
        onOpenChange={(open) => {
          if (!open) setOpenOrderId(null);
        }}
      />
    </>
  );
}
