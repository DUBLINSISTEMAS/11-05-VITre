"use client";

// Lista de pedidos — port Dublin v3 (ADR-0019, Onda A.6).
// REWRITE pra usar `b3-tbl` canônico (substitui grid custom anterior).
// Mobile responsivo: CSS @media (max-width: 640px) em globals.css faz
// thead esconder e tbody tr virar block stack (já no globals).
//
// Cada row continua clicável (abre OrderDetailDialog ao clicar). Checkbox
// master + per-row é placeholder visual (bulk actions ficam pra onda futura).

import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { OrderDetailDialog } from "@/components/admin/order-detail-dialog";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

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

function paymentLabel(method: OrderPaymentMethod | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_LABELS[method];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <>
      <table className="b3-tbl">
        <thead>
          <tr>
            <th style={{ paddingLeft: 20, width: 28 }}>
              <span className="sr-only">Selecionar</span>
            </th>
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
              onClick={() => setOpenOrderId(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenOrderId(o.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir pedido ${o.shortCode}`}
              className="cursor-pointer outline-none focus-visible:bg-bg-app"
            >
              <td style={{ paddingLeft: 20 }}>
                <input
                  type="checkbox"
                  aria-label={`Selecionar pedido ${o.shortCode}`}
                  onClick={(e) => e.stopPropagation()}
                  disabled
                  className="cursor-not-allowed opacity-50"
                />
              </td>
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
                <span className="b3-pill">{paymentLabel(o.paymentMethod)}</span>
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
                <OrderStatusBadge status={o.status} />
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

      <OrderDetailDialog
        orderId={openOrderId}
        onOpenChange={(open) => {
          if (!open) setOpenOrderId(null);
        }}
      />
    </>
  );
}
