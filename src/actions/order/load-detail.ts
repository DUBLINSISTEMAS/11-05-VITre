"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerTable,
  orderItemTable,
  orderPaymentTable,
  orderReturnTable,
  orderTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type { ORDER_STATUS_VALUES } from "./schema";

export type OrderDetailItem = {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  imageUrlSnapshot: string | null;
  priceInCentsSnapshot: number;
  quantity: number;
};

/**
 * Cliente vinculado ao pedido (Fase 3 — ADR-0014). `null` quando o
 * pedido não tem `customer_id` setado (pedidos antigos do storefront ou
 * pedidos novos ainda não vinculados manualmente pelo lojista).
 */
export type OrderDetailLinkedCustomer = {
  id: string;
  name: string;
  phone: string;
};

/** Pre-Sprint-6 C — devolução registrada deste order. */
export type OrderDetailReturn = {
  id: string;
  returnType: "full" | "partial";
  refundedInCents: number;
  reason: string;
  createdAt: Date;
};

/**
 * Onda 1.2/1.3 (2026-05-22) — pagamento real do pedido. UMA linha por
 * forma usada (R$80 cash + R$50 pix = 2 linhas). Antes o detalhe lia
 * apenas `order.paymentMethod` legacy (primeira linha), escondendo
 * pagamento misto do lojista e do cliente.
 */
export type OrderDetailPayment = {
  id: string;
  method: "cash" | "pix" | "debit" | "credit" | "other";
  amountInCents: number;
  /** Pra cálculo de troco quando method='cash'. NULL pros outros. */
  cashReceivedInCents: number | null;
  notes: string | null;
};

export type OrderDetail = {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string | null;
  customerNotes: string | null;
  customerId: string | null;
  linkedCustomer: OrderDetailLinkedCustomer | null;
  totalInCents: number;
  status: (typeof ORDER_STATUS_VALUES)[number];
  whatsappOpenedAt: Date | null;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  /** Sprint 1A Fase 4 — validade do orçamento (NULL quando status != quote). */
  quoteValidUntil: Date | null;
  createdAt: Date;
  items: OrderDetailItem[];
  /** Onda 1.3 — multi-pagamento real. Vazio em orçamento/quote ainda sem pagamento. */
  payments: OrderDetailPayment[];
  /** Pre-Sprint-6 C — lista de devoluções (vazia quando venda não foi devolvida). */
  returns: OrderDetailReturn[];
};

export type LoadOrderDetailResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; error: string };

/**
 * Carrega detalhe completo do pedido sob demanda (Onda 4, 2026-05-12).
 * Usado pelo OrderDetailDialog — substitui a rota /admin/pedidos/[id].
 * Tudo passa pelo withTenant garantindo isolamento por loja.
 */
export async function loadOrderDetail(
  orderId: string,
): Promise<LoadOrderDetailResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const result = await withTenant(store.id, session.user.id, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: and(
        eq(orderTable.id, orderId),
        eq(orderTable.storeId, store.id),
      ),
      columns: {
        id: true,
        shortCode: true,
        customerName: true,
        customerPhone: true,
        customerNotes: true,
        customerId: true,
        totalInCents: true,
        status: true,
        whatsappOpenedAt: true,
        confirmedAt: true,
        expiresAt: true,
        quoteValidUntil: true,
        createdAt: true,
      },
    });
    if (!order) return null;

    const items = await tx
      .select({
        id: orderItemTable.id,
        productNameSnapshot: orderItemTable.productNameSnapshot,
        variantNameSnapshot: orderItemTable.variantNameSnapshot,
        imageUrlSnapshot: orderItemTable.imageUrlSnapshot,
        priceInCentsSnapshot: orderItemTable.priceInCentsSnapshot,
        quantity: orderItemTable.quantity,
      })
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, orderId));

    // Onda 1.3 — multi-pagamento real. Ordenado por createdAt ASC pra
    // preservar a ordem em que o lojista digitou (cash, depois pix etc.).
    const payments = await tx
      .select({
        id: orderPaymentTable.id,
        method: orderPaymentTable.method,
        amountInCents: orderPaymentTable.amountInCents,
        cashReceivedInCents: orderPaymentTable.cashReceivedInCents,
        notes: orderPaymentTable.notes,
      })
      .from(orderPaymentTable)
      .where(
        and(
          eq(orderPaymentTable.orderId, orderId),
          eq(orderPaymentTable.storeId, store.id),
        ),
      )
      .orderBy(asc(orderPaymentTable.createdAt));

    let linkedCustomer: OrderDetailLinkedCustomer | null = null;
    if (order.customerId) {
      const c = await tx.query.customerTable.findFirst({
        where: and(
          eq(customerTable.id, order.customerId),
          eq(customerTable.storeId, store.id),
        ),
        columns: { id: true, name: true, phone: true },
      });
      if (c) linkedCustomer = c;
    }

    // Pre-Sprint-6 C — carrega devoluções (geralmente 0 ou 1).
    const returns = await tx
      .select({
        id: orderReturnTable.id,
        returnType: orderReturnTable.returnType,
        refundedInCents: orderReturnTable.refundedInCents,
        reason: orderReturnTable.reason,
        createdAt: orderReturnTable.createdAt,
      })
      .from(orderReturnTable)
      .where(
        and(
          eq(orderReturnTable.orderId, orderId),
          eq(orderReturnTable.storeId, store.id),
        ),
      )
      .orderBy(desc(orderReturnTable.createdAt));

    return { order, items, payments, linkedCustomer, returns };
  });

  if (!result) return { ok: false, error: "Pedido não encontrado." };

  return {
    ok: true,
    order: {
      ...result.order,
      status: result.order.status as (typeof ORDER_STATUS_VALUES)[number],
      items: result.items,
      payments: result.payments,
      linkedCustomer: result.linkedCustomer,
      returns: result.returns,
    },
  };
}
