/**
 * Loader público de pedido por publicToken.
 *
 * Usado tanto pela página `/sucesso` quanto pela `/p/[publicToken]`.
 * Ambas são públicas (sem login) — cliente final acessa o pedido via
 * link que recebeu/copiou.
 *
 * Service role: pedido vive fora da árvore de tenant (cliente não faz
 * parte da loja); resolver por token público opaco é o caso documentado.
 *
 * Sem cache: pedido muda status (Sandra confirma/cancela) e cliente
 * espera ver o estado atual. Volume é baixo o suficiente.
 */
import { eq } from "drizzle-orm";

import type {
  Order,
  OrderItem,
  Store,
} from "@/db/schema";
import {
  orderItemTable,
  orderTable,
  storeTable,
} from "@/db/schema";
import { withServiceRole } from "@/lib/tenant";

export interface OrderWithItems extends Order {
  items: OrderItem[];
  store: Pick<
    Store,
    | "id"
    | "slug"
    | "name"
    | "logoUrl"
    | "primaryColor"
    | "whatsappNumber"
    | "whatsappDisplay"
  >;
}

async function getOrderByColumn(
  column: typeof orderTable.publicToken | typeof orderTable.shortCode,
  value: string,
  reason: string,
): Promise<OrderWithItems | null> {
  return withServiceRole(reason, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: eq(column, value),
    });
    if (!order) return null;

    const [store, items] = await Promise.all([
      tx.query.storeTable.findFirst({
        where: eq(storeTable.id, order.storeId),
        columns: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          whatsappNumber: true,
          whatsappDisplay: true,
        },
      }),
      tx
        .select()
        .from(orderItemTable)
        .where(eq(orderItemTable.orderId, order.id)),
    ]);

    if (!store) return null;
    return { ...order, items, store };
  });
}

export async function getOrderByPublicToken(
  publicToken: string,
): Promise<OrderWithItems | null> {
  return getOrderByColumn(
    orderTable.publicToken,
    publicToken,
    "storefront: order by public token",
  );
}

export async function getOrderByShortCode(
  shortCode: string,
): Promise<OrderWithItems | null> {
  return getOrderByColumn(
    orderTable.shortCode,
    shortCode,
    "storefront: order by short code",
  );
}
