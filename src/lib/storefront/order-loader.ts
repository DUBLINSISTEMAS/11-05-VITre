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
 * Sem cache: pedido muda status (lojista confirma/cancela) e cliente
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
    | "whatsappTemplate"
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

    // SÉRIE dentro do tx — `pg` deprecou paralelas no mesmo client.
    const store = await tx.query.storeTable.findFirst({
      where: eq(storeTable.id, order.storeId),
      columns: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        whatsappNumber: true,
        whatsappDisplay: true,
        whatsappTemplate: true,
      },
    });
    const items = await tx
      .select()
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, order.id));

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

/**
 * ATENÇÃO: NÃO usar em fluxos públicos. shortCode (4 chars, ~14M combos)
 * é adivinhável via rate-limit-burst. Use {@link getOrderByPublicToken}
 * para qualquer rota acessível por anônimo (/sucesso, /p/[token]).
 *
 * Reservado pra uso interno: suporte manual, busca admin por código
 * curto que o cliente forneceu, ou ferramentas internas. shortCode
 * continua sendo o identificador "amigável" pra exibir/falar.
 */
export async function getOrderByShortCode(
  shortCode: string,
): Promise<OrderWithItems | null> {
  return getOrderByColumn(
    orderTable.shortCode,
    shortCode,
    "internal: order by short code",
  );
}
