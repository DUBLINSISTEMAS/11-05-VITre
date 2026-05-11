"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { orderTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { restockOrderItems } from "@/lib/order/restock";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type UpdateOrderStatusInput,
  updateOrderStatusSchema,
  VALID_TRANSITIONS,
} from "./schema";

export type UpdateOrderStatusResult =
  | { ok: true; status: UpdateOrderStatusInput["nextStatus"] }
  | { ok: false; error: string };

/**
 * Atualiza status do pedido respeitando transições válidas (ver
 * `VALID_TRANSITIONS`). Lojista não pode "desconfirmar" um pedido —
 * confirmed → awaiting_whatsapp não é permitido. Setamos `confirmedAt`
 * automaticamente quando vira `confirmed`.
 *
 * Optimistic lock (gate C1 da auditoria 2026-05-11):
 *  - UPDATE inclui `AND status = <status lido no SELECT>` + `.returning()`.
 *  - Se outro processo (cron expire-orders, outra aba do lojista) mudou o
 *    status entre o SELECT e o UPDATE, o UPDATE vira no-op (0 rows). A
 *    action retorna erro pra o cliente saber que precisa recarregar.
 *  - Sem isso, lojista clicando "Cancelar" 2× rápido = 2× `restockOrderItems`
 *    = estoque infla silencioso.
 *
 * Reposição de estoque:
 *  - Em `awaiting_whatsapp → canceled` ou `confirmed → canceled` ou
 *    `awaiting_whatsapp → expired`, a função chama `restockOrderItems`
 *    SÓ DEPOIS de confirmar que o UPDATE pegou (returning.length > 0),
 *    na MESMA transação `withTenant` — uma falha rola tudo back
 *    (atomicidade entre estoque e status).
 *  - `fulfilled` é terminal (ver VALID_TRANSITIONS), então não há cancel
 *    pós-fulfilled — mas se algum dia mudarmos isso, NÃO repor: cliente
 *    já recebeu o produto.
 */
export async function updateOrderStatus(
  input: UpdateOrderStatusInput,
): Promise<UpdateOrderStatusResult> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const result = await withTenant(store.id, userId, async (tx) => {
    const order = await tx.query.orderTable.findFirst({
      where: and(
        eq(orderTable.id, parsed.data.orderId),
        eq(orderTable.storeId, store.id),
      ),
      columns: { id: true, status: true },
    });
    if (!order) {
      return { ok: false, error: "Pedido não encontrado." } as const;
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(parsed.data.nextStatus)) {
      return {
        ok: false,
        error: "Essa mudança de status não é permitida.",
      } as const;
    }

    // UPDATE com optimistic lock — inclui `status = order.status` no WHERE
    // pra evitar race (gate C1). `.returning()` confirma se o UPDATE pegou.
    const updated = await tx
      .update(orderTable)
      .set({
        status: parsed.data.nextStatus,
        ...(parsed.data.nextStatus === "confirmed"
          ? { confirmedAt: new Date() }
          : {}),
      })
      .where(
        and(
          eq(orderTable.id, parsed.data.orderId),
          eq(orderTable.storeId, store.id),
          eq(orderTable.status, order.status),
        ),
      )
      .returning({ id: orderTable.id });

    if (updated.length === 0) {
      // Outro processo já alterou o status entre o SELECT e o UPDATE.
      // Sem repor estoque — quem fez a alteração concorrente já tratou.
      return {
        ok: false,
        error:
          "Este pedido foi atualizado em outra tela. Recarregue a página.",
      } as const;
    }

    // Reposição de estoque DEPOIS do UPDATE bem-sucedido — mesma transação
    // garante atomicidade. Só repor quando o pedido sai do fluxo SEM ser
    // entregue (canceled ou expired a partir de awaiting_whatsapp/confirmed).
    const isCancelFromOpen =
      (order.status === "awaiting_whatsapp" || order.status === "confirmed") &&
      parsed.data.nextStatus === "canceled";
    const isExpireFromAwaiting =
      order.status === "awaiting_whatsapp" &&
      parsed.data.nextStatus === "expired";
    if (isCancelFromOpen || isExpireFromAwaiting) {
      await restockOrderItems(tx, order.id, store.id);
    }

    return { ok: true, status: parsed.data.nextStatus } as const;
  });

  if (!result.ok) return result;

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.orderId}`);
  // Convenção #4: storefront público depende de estado de pedido —
  // cancel/expire repõem estoque, então o tag garante que PDP/listagens
  // leiam fresh sem depender do TTL de 5min.
  revalidateTag(`store-${store.slug}`);

  return result;
}
