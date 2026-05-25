// Tabela "Vendas recentes" no dashboard admin (port Dublin v3, Onda 5a).
// Top N vendas mais recentes — DataGrid 6-col mono no desktop, cards
// compactos no mobile. NÃO usa `b3-tbl` (que é seletor pra <table> HTML);
// aqui é grid CSS pra responsividade. Container adota `b3-card`; tokens
// muted/accent/border substituídos por bg-app/ink/line Dublin.
//
// Handoff design 2026-05-25 (Passo 4): click abre o drawer global de
// detalhe da venda INLINE (sem navegar pra /admin/pedidos). Mantém `href`
// como fallback pra Ctrl+click (abrir em nova aba na listagem cheia) e
// pra SSR/sem-JS.
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import {
  OPEN_ORDER_DETAIL_EVENT,
  type OpenOrderDetailEventDetail,
} from "@/components/admin/order-detail-events";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

/**
 * Handler de click: se for click "normal" (sem modificadores), dispara
 * o evento que abre o drawer global e atualiza ?detail= via History API
 * (sem rerender). Click com Ctrl/Cmd/Shift/middle-button cai no href
 * normal (browser abre em nova aba/janela ou listagem cheia).
 */
function handleRowClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  orderId: string,
) {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return; // deixa o browser seguir o href
  }
  e.preventDefault();
  window.dispatchEvent(
    new CustomEvent<OpenOrderDetailEventDetail>(OPEN_ORDER_DETAIL_EVENT, {
      detail: { orderId },
    }),
  );
  // Mantém URL sincronizada na rota atual (/admin) — listener faria
  // isso também, mas adiantando aqui pra evitar 1 tick de mismatch.
  const url = new URL(window.location.href);
  url.searchParams.set("detail", orderId);
  window.history.replaceState(null, "", url.toString());
}

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
    <div className="b3-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-ink-1 text-[13.5px] font-semibold tracking-tight">
          Vendas recentes
        </h2>
        <Link
          href="/admin/pedidos"
          prefetch
          className="text-ink-4 hocus:text-brand text-[11.5px] font-medium transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-ink-4 px-4 py-8 text-center text-sm">
          Nenhuma venda ainda.
        </div>
      ) : (
        <>
          {/* Desktop: DataGrid 6 colunas */}
          <div
            role="rowgroup"
            className={`text-eyebrow bg-bg-app hidden ${GRID_COLS} items-center gap-3 border-b border-line px-4 py-2.5 sm:grid sm:px-5`}
          >
            <span>Venda</span>
            <span>Cliente</span>
            <span>Total</span>
            <span>Quando</span>
            <span>Status</span>
            <span aria-hidden />
          </div>

          <ul className="divide-line divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                {/* Desktop */}
                <Link
                  href={`/admin/pedidos?detail=${o.id}`}
                  prefetch
                  onClick={(e) => handleRowClick(e, o.id)}
                  className={`hocus:bg-bg-app group hidden ${GRID_COLS} items-center gap-3 px-4 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid sm:px-5`}
                >
                  <span className="font-mono text-[13px] font-medium tabular-nums text-ink-1">
                    {o.shortCode}
                  </span>
                  <span className="min-w-0 truncate font-medium text-ink-1">
                    {o.customerName}
                  </span>
                  <span className="font-mono tabular-nums text-ink-1">
                    {formatBRL(o.totalInCents)}
                  </span>
                  <span className="text-ink-4 font-mono text-[12px]">
                    {formatRelativeDate(o.createdAt)}
                  </span>
                  <span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                  <span
                    aria-hidden
                    className="text-ink-5 group-hover:text-ink-1 flex justify-end transition-colors"
                  >
                    <ChevronRightIcon className="size-3.5" />
                  </span>
                </Link>

                {/* Mobile: card compacto */}
                <Link
                  href={`/admin/pedidos?detail=${o.id}`}
                  prefetch
                  onClick={(e) => handleRowClick(e, o.id)}
                  className="hocus:bg-bg-app group flex items-center gap-3 px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:hidden"
                >
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-ink-1">
                    {o.shortCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-1">
                      {o.customerName}
                    </p>
                    <p className="text-ink-4 font-mono text-[11px]">
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
