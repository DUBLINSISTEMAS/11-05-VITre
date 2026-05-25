"use client";

// Lista de pedidos — port Dublin v3 (ADR-0019, Onda A.6).
// Usa `b3-tbl` canônico; mobile responsivo via @media em globals.css
// (thead esconde, tbody tr vira block stack).
//
// Cada row continua clicável — handoff design 2026-05-25 (Passo 4):
// agora dispara `OPEN_ORDER_DETAIL_EVENT` em vez de manter state local.
// O drawer global (montado em admin-shell via OrderDetailDrawerListener)
// é quem segura o open state + sincroniza URL.

import { MessageCircleIcon } from "lucide-react";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import {
  OPEN_ORDER_DETAIL_EVENT,
  type OpenOrderDetailEventDetail,
} from "@/components/admin/order-detail-events";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

function openOrderDetail(orderId: string) {
  window.dispatchEvent(
    new CustomEvent<OpenOrderDetailEventDetail>(OPEN_ORDER_DETAIL_EVENT, {
      detail: { orderId },
    }),
  );
}

type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
type OrderChannel = "whatsapp" | "balcao";
type OrderPaymentMethod = "cash" | "pix" | "debit" | "credit" | "other";

export interface OrderTableRow {
  id: string;
  shortCode: string;
  customerName: string;
  /** NULL para venda balcão walk-in (Fase 5 — ADR-0016). */
  customerPhone: string | null;
  totalInCents: number;
  status: OrderStatus;
  createdAt: Date;
  channel?: OrderChannel;
  paymentMethod?: OrderPaymentMethod | null;
  /**
   * Onda 1.3 (2026-05-22) — quantas linhas em order_payment este pedido tem.
   * 0 = orçamento/quote sem pagamento. 1 = forma única (mostra label). 2+ =
   * pagamento misto (mostra "Misto"). Padrão 0 quando caller não fornecer
   * (mantém compat com legacy).
   */
  paymentCount?: number;
  /**
   * Onda 2.13 — saldo fiado em aberto vinculado a esta venda. > 0 renderiza
   * badge "Fiado R$X" na linha, pra lojista enxergar sem clicar.
   */
  creditOutstandingInCents?: number;
}

export interface OrdersTableProps {
  orders: ReadonlyArray<OrderTableRow>;
}

const PAYMENT_LABELS: Record<OrderPaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

function paymentLabel(
  method: OrderPaymentMethod | null | undefined,
  paymentCount: number | undefined,
): string {
  // Multi-pagamento — não engana mostrando só a primeira forma.
  if (paymentCount && paymentCount > 1) return "Misto";
  if (!method) return "—";
  return PAYMENT_LABELS[method];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <>
      <table className="b3-tbl">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Pagamento</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              onClick={() => openOrderDetail(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openOrderDetail(o.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir venda ${o.shortCode}`}
              className="cursor-pointer outline-none focus-visible:bg-bg-app"
            >
              <td
                className="mono"
                style={{ color: "var(--brand)", fontWeight: 600 }}
              >
                {o.shortCode}
              </td>
              <td style={{ fontWeight: 500 }}>{o.customerName}</td>
              <td>
                {o.channel === "balcao" ? (
                  <span className="b3-pill b3-pill--gold">Balcão</span>
                ) : (
                  <span className="b3-pill b3-pill--ok">
                    <MessageCircleIcon size={11} aria-hidden />
                    WhatsApp
                  </span>
                )}
              </td>
              <td>
                <span className="b3-pill">
                  {paymentLabel(o.paymentMethod, o.paymentCount)}
                </span>
              </td>
              <td
                className="mono"
                style={{
                  textAlign: "right",
                  fontWeight: 600,
                }}
              >
                {formatBRL(o.totalInCents)}
              </td>
              <td>
                <div className="flex flex-wrap items-center gap-1">
                  <OrderStatusBadge status={o.status} />
                  {(o.creditOutstandingInCents ?? 0) > 0 ? (
                    <span
                      className="b3-pill b3-pill--warn"
                      title="Saldo fiado em aberto vinculado a esta venda"
                    >
                      Fiado {formatBRL(o.creditOutstandingInCents!)}
                    </span>
                  ) : null}
                </div>
              </td>
              <td
                className="mono"
                style={{ fontSize: 11.5, color: "var(--ink-4)" }}
              >
                {formatRelativeDate(o.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
