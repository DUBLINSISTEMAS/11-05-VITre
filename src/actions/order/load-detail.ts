"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { customerTable, orderItemTable, orderTable } from "@/db/schema";
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

    return { order, items, linkedCustomer };
  });

  if (!result) return { ok: false, error: "Pedido não encontrado." };

  return {
    ok: true,
    order: {
      ...result.order,
      status: result.order.status as (typeof ORDER_STATUS_VALUES)[number],
      items: result.items,
      linkedCustomer: result.linkedCustomer,
    },
  };
}
