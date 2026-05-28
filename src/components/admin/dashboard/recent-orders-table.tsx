// Tabela "Vendas recentes" no dashboard — Finexy-style + UX mobile sênior.
//
// Desktop: tabela 8 colunas (checkbox / id / data / cliente / categoria /
// status / itens / total) + chevron de afford.
// Mobile: card vertical com cabeçalho (id + total) + nome + meta (data ·
// categoria · itens) + status pill. Sort dropdown some no mobile (lojista
// vai pro /admin/pedidos cheio pra sort).
//
// Click em linha continua abrindo o drawer global (OPEN_ORDER_DETAIL_EVENT).
// Ctrl+click cai no href fallback.

"use client";

import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import {
  OPEN_ORDER_DETAIL_EVENT,
  type OpenOrderDetailEventDetail,
} from "@/components/admin/order-detail-events";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBRL } from "@/lib/pricing";

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
    return;
  }
  e.preventDefault();
  window.dispatchEvent(
    new CustomEvent<OpenOrderDetailEventDetail>(OPEN_ORDER_DETAIL_EVENT, {
      detail: { orderId },
    }),
  );
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
  categoryLabel: string;
  itemCount: number;
}

export interface RecentOrdersTableProps {
  orders: ReadonlyArray<RecentOrderRow>;
}

type SortKey = "recent" | "highest" | "lowest";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Mais recentes" },
  { value: "highest", label: "Maior valor" },
  { value: "lowest", label: "Menor valor" },
];

const GRID_COLS =
  "grid-cols-[28px_100px_minmax(0,100px)_minmax(0,1.4fr)_minmax(0,1fr)_120px_80px_minmax(0,110px)_20px]";

function shortDate(d: Date): string {
  const day = d.getDate();
  const monthShort = d.toLocaleDateString("pt-BR", { month: "short" });
  return `${day} ${monthShort.replace(".", "")}`;
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = orders.slice();
    if (q.length > 0) {
      arr = arr.filter(
        (o) =>
          o.shortCode.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.categoryLabel.toLowerCase().includes(q),
      );
    }
    switch (sortBy) {
      case "highest":
        arr.sort((a, b) => b.totalInCents - a.totalInCents);
        break;
      case "lowest":
        arr.sort((a, b) => a.totalInCents - b.totalInCents);
        break;
      case "recent":
      default:
        arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }
    return arr;
  }, [orders, query, sortBy]);

  const allChecked =
    visible.length > 0 && visible.every((o) => selected.has(o.id));
  const someChecked = !allChecked && visible.some((o) => selected.has(o.id));

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(visible.map((o) => o.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)!.label;

  return (
    <div className="b3-card overflow-hidden">
      <div className="b3-recent-orders-hd">
        <h2 className="b3-recent-orders-title">Vendas recentes</h2>
        <div className="b3-recent-orders-actions">
          <label className="b3-recent-orders-search">
            <SearchIcon size={13} aria-hidden />
            <input
              type="search"
              placeholder="Buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar vendas"
            />
          </label>
          {/* Sort some em mobile — lojista vai pro /admin/pedidos cheio
              quando precisa de ordenação custom. */}
          <DropdownMenu>
            <DropdownMenuTrigger className="b3-recent-orders-sort">
              <ArrowUpDownIcon size={13} aria-hidden />
              <span className="b3-recent-orders-sort-label">{sortLabel}</span>
              <ChevronDownIcon size={13} aria-hidden className="opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6}>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuItem
                  key={o.value}
                  onSelect={() => setSortBy(o.value)}
                >
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-ink-4 px-4 py-8 text-center text-sm">
          {query ? "Nenhuma venda encontrada." : "Nenhuma venda ainda."}
        </div>
      ) : (
        <>
          {/* Desktop: header */}
          <div
            role="rowgroup"
            className={`text-eyebrow bg-bg-app hidden ${GRID_COLS} items-center gap-3 border-b border-line px-4 py-2.5 sm:grid sm:px-5`}
          >
            <span className="flex items-center">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
                aria-label={allChecked ? "Desmarcar todos" : "Selecionar todos"}
                className="b3-row-checkbox"
              />
            </span>
            <span>ID</span>
            <span>Data</span>
            <span>Cliente</span>
            <span>Categoria</span>
            <span>Status</span>
            <span className="text-right">Itens</span>
            <span className="text-right">Total</span>
            <span aria-hidden />
          </div>

          <ul className="divide-line divide-y">
            {visible.map((o) => {
              const isSel = selected.has(o.id);
              return (
                <li key={o.id}>
                  {/* Desktop */}
                  <div
                    className={`hidden ${GRID_COLS} items-center gap-3 px-4 text-sm sm:grid sm:px-5`}
                  >
                    <span className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Selecionar venda ${o.shortCode}`}
                        className="b3-row-checkbox"
                      />
                    </span>
                    <Link
                      href={`/admin/pedidos?detail=${o.id}`}
                      prefetch
                      onClick={(e) => handleRowClick(e, o.id)}
                      className="col-span-7 hocus:bg-bg-app grid grid-cols-subgrid items-center gap-3 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="font-mono text-[12.5px] font-semibold tabular-nums text-ink-1">
                        #{o.shortCode}
                      </span>
                      <span className="font-mono text-[12.5px] tabular-nums text-ink-2">
                        {shortDate(o.createdAt)}
                      </span>
                      <span className="min-w-0 truncate font-medium text-ink-1">
                        {o.customerName}
                      </span>
                      <span className="min-w-0 truncate text-ink-3">
                        {o.categoryLabel}
                      </span>
                      <span>
                        <OrderStatusBadge status={o.status} />
                      </span>
                      <span className="text-right font-mono tabular-nums text-ink-2">
                        {o.itemCount}
                      </span>
                      <span className="text-right font-mono font-semibold tabular-nums text-ink-1">
                        {formatBRL(o.totalInCents)}
                      </span>
                    </Link>
                    <span
                      aria-hidden
                      className="text-ink-5 group-hover:text-ink-1 flex justify-end transition-colors"
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </span>
                  </div>

                  {/* Mobile: card vertical com toda info importante */}
                  <Link
                    href={`/admin/pedidos?detail=${o.id}`}
                    prefetch
                    onClick={(e) => handleRowClick(e, o.id)}
                    className="hocus:bg-bg-app flex flex-col gap-1.5 px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:hidden"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[12.5px] font-semibold tabular-nums text-ink-1">
                        #{o.shortCode}
                      </span>
                      <span className="font-mono text-[14px] font-bold tabular-nums text-ink-1">
                        {formatBRL(o.totalInCents)}
                      </span>
                    </div>
                    <p className="truncate text-[13.5px] font-medium text-ink-1">
                      {o.customerName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-4">
                      <span className="font-mono">
                        {shortDate(o.createdAt)}
                      </span>
                      {o.categoryLabel !== "—" ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="min-w-0 truncate">
                            {o.categoryLabel}
                          </span>
                        </>
                      ) : null}
                      <span aria-hidden>·</span>
                      <span>
                        {o.itemCount} {o.itemCount === 1 ? "item" : "itens"}
                      </span>
                      <span className="ml-auto">
                        <OrderStatusBadge status={o.status} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
