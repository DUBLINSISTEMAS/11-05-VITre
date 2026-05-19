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
    | "paymentMethodsNote"
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
        paymentMethodsNote: true,
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
 * ATENÇÃO — USO ADMIN/INTERNO APENAS. NÃO expor em rota anonima.
 *
 * S3 da auditoria 2026-05-19: shortCode tem 4-6 chars (pedidos antigos
 * pre-2026-05-11 sao 4 chars / ~14M combos = enumeravel via
 * rate-limit-burst). Para qualquer rota publica use
 * {@link getOrderByPublicToken} (32 chars opaco).
 *
 * Callers atuais (grep `getOrderByShortCode` em src/, 2026-05-19):
 *   - NENHUM. A funcao esta exportada mas nao e chamada em lugar nenhum
 *     do codigo de produto. Mantida como contrato disponivel para:
 *     (a) busca admin por codigo curto que o cliente forneceu por voz/WA
 *     (b) suporte manual (psql/Studio)
 *   - Se algum dia for chamada de rota publica, ADICIONAR rate-limit por
 *     IP (`rateLimits.publicApi`) E protecao contra timing-attack
 *     (constant-time compare ou wrapper anti-bruteforce). Hoje o caller
 *     unico potencial seria uma pagina admin atras de auth — ok.
 *
 * shortCode continua sendo o identificador "amigavel" pra exibir/falar.
 * O publicToken e a chave de URL em fluxos publicos.
 */
export async function getOrderByShortCode(
  shortCode: string,
): Promise<OrderWithItems | null> {
  return getOrderByColumn(
    orderTable.shortCode,
    shortCode,
    "internal: order by short code (admin/support only)",
  );
}
