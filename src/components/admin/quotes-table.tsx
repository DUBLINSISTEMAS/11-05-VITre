"use client";

/**
 * QuotesTable — listagem de orçamentos (Semana 5 da ressignificação).
 *
 * Diferente de OrdersTable porque a coluna que IMPORTA aqui é Validade
 * (com cor: verde >2d, amarelo 1-2d, vermelho expirado) — orçamentos
 * vivem ou morrem por essa data.
 *
 * Click abre o drawer global via OPEN_ORDER_DETAIL_EVENT (mesmo padrão
 * de recent-orders-table.tsx). Ctrl+click cai no href fallback que
 * abre o printable em nova aba.
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import {
  OPEN_ORDER_DETAIL_EVENT,
  type OpenOrderDetailEventDetail,
} from "@/components/admin/order-detail-events";
import { formatBRL } from "@/lib/pricing";

export interface QuoteTableRow {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string | null;
  totalInCents: number;
  itemQuantity: number;
  createdAt: Date;
  /** NULL pra orçamentos antigos sem validade configurada. */
  quoteValidUntil: Date | null;
}

export interface QuotesTableProps {
  quotes: ReadonlyArray<QuoteTableRow>;
}

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

/**
 * Calcula classificação de validade pra coloração.
 *   - "expired":  validUntil < now (em vermelho)
 *   - "warning":  validUntil < now+2d (amarelo — joalheiro liga pro cliente)
 *   - "ok":       validUntil >= now+2d (verde — tranquilo)
 *   - "none":     sem validade (cinza)
 */
type ValidityClass = "expired" | "warning" | "ok" | "none";

function classifyValidity(validUntil: Date | null, now: Date): ValidityClass {
  if (!validUntil) return "none";
  const ms = validUntil.getTime() - now.getTime();
  if (ms < 0) return "expired";
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  if (ms < TWO_DAYS_MS) return "warning";
  return "ok";
}

function formatRelativeValidity(
  validUntil: Date | null,
  now: Date,
): string {
  if (!validUntil) return "—";
  const ms = validUntil.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ms < 0) {
    const days = Math.floor(-ms / dayMs);
    if (days === 0) return "Expirou hoje";
    if (days === 1) return "Expirou ontem";
    return `Expirou há ${days}d`;
  }
  const days = Math.floor(ms / dayMs);
  if (days === 0) return "Expira hoje";
  if (days === 1) return "Expira amanhã";
  return `${days}d restantes`;
}

const VALIDITY_COLOR: Record<ValidityClass, string> = {
  expired: "text-destructive font-semibold",
  warning: "text-state-warning font-semibold",
  ok: "text-state-success font-medium",
  none: "text-ink-4",
};

function shortDate(d: Date): string {
  const day = d.getDate();
  const monthShort = d
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  return `${day} ${monthShort}`;
}

const GRID_COLS =
  "grid-cols-[100px_minmax(0,1.4fr)_minmax(0,100px)_60px_minmax(0,110px)_minmax(0,140px)_20px]";

export function QuotesTable({ quotes }: QuotesTableProps) {
  const now = new Date();

  if (quotes.length === 0) {
    return (
      <div className="b3-card p-10 text-center">
        <p className="text-ink-3 text-[13px]">
          Nenhum orçamento neste filtro.
        </p>
        <p className="text-ink-4 mt-1 text-[12px]">
          Use o PDV pra criar um orçamento — itens + cliente + &quot;Salvar como
          orçamento&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="b3-card overflow-hidden">
      <div
        className={`text-ink-4 hidden border-b border-line bg-bg-app/40 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider md:grid ${GRID_COLS} gap-3`}
      >
        <span>Código</span>
        <span>Cliente</span>
        <span>Criado</span>
        <span className="text-right">Itens</span>
        <span className="text-right">Total</span>
        <span>Validade</span>
        <span aria-hidden></span>
      </div>

      <ul className="divide-line divide-y">
        {quotes.map((q) => {
          const klass = classifyValidity(q.quoteValidUntil, now);
          return (
            <li key={q.id}>
              <Link
                href={`/admin/pedidos/${q.id}/imprimir`}
                onClick={(e) => handleRowClick(e, q.id)}
                prefetch={false}
                className={`hover:bg-bg-app/60 grid items-center gap-3 px-4 py-3 text-[13px] transition-colors md:${GRID_COLS}`}
              >
                <span className="mono text-ink-2 font-medium tabular-nums">
                  #{q.shortCode}
                </span>
                <span className="min-w-0">
                  <span className="text-ink-1 block truncate font-medium">
                    {q.customerName}
                  </span>
                  {q.customerPhone ? (
                    <span className="text-ink-4 mono block truncate text-[11.5px]">
                      {q.customerPhone}
                    </span>
                  ) : null}
                </span>
                <span className="text-ink-3 text-[12px]">
                  {shortDate(q.createdAt)}
                </span>
                <span className="text-ink-2 mono text-right tabular-nums">
                  {q.itemQuantity}
                </span>
                <span className="text-ink-1 mono text-right font-semibold tabular-nums">
                  {formatBRL(q.totalInCents)}
                </span>
                <span
                  className={`text-[12px] tabular-nums ${VALIDITY_COLOR[klass]}`}
                  title={
                    q.quoteValidUntil
                      ? q.quoteValidUntil.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "Sem validade definida"
                  }
                >
                  {formatRelativeValidity(q.quoteValidUntil, now)}
                </span>
                <ChevronRightIcon
                  size={14}
                  className="text-ink-4"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
