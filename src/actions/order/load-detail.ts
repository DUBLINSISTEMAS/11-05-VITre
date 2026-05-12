"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { orderItemTable, orderTable } from "@/db/schema";
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

export type OrderDetail = {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  totalInCents: number;
  status: (typeof ORDER_STATUS_VALUES)[number];
  whatsappOpenedAt: Date | null;
  confirmedAt: Date | null;
  expiresAt: Date;
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
        totalInCents: true,
        status: true,
        whatsappOpenedAt: true,
        confirmedAt: true,
        expiresAt: true,
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

    return { order, items };
  });

  if (!result) return { ok: false, error: "Pedido não encontrado." };

  return {
    ok: true,
    order: {
      ...result.order,
      status: result.order.status as (typeof ORDER_STATUS_VALUES)[number],
      items: result.items,
    },
  };
}
