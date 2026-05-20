"use server";

/**
 * recordOrderReturn — Pre-Sprint-6 C.
 *
 * Registra devolução de venda balcão. V1 só aceita devolução TOTAL
 * (`return_type='full'`) — cliente trouxe TUDO de volta. Parcial item-a-item
 * fica pra v2.
 *
 * Fluxo:
 *   1. Validar order (existe, é da loja, status permite devolução,
 *      ainda não foi devolvida — UNIQUE parcial no DB também impede).
 *   2. Validar que NÃO há receivable pendente vinculado ao order — fiado
 *      em aberto é caso complexo (estornar o fiado é fluxo separado via
 *      reverseReceivablePayment). Lojista resolve fiado antes.
 *   3. Inserir order_return + 1 order_return_item por item da venda.
 *   4. INSERT stock_movements type='return' (reusa restockOrderItems).
 *   5. UPDATE order.status = 'returned'.
 *   6. INSERT cash_adjustment 'other_out' se houver caixa aberto.
 *
 * Tudo numa única withTenant transaction. Advisory lock por order pra
 * serializar contra duplo-clique.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  cashAdjustmentTable,
  cashSessionTable,
  orderItemTable,
  orderReturnItemTable,
  orderReturnTable,
  orderTable,
  receivableTable,
  storeTable,
} from "@/db/schema";
import { extractClientContext, recordAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { restockOrderItems } from "@/lib/order/restock";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { type Tx, withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  orderId: z.string().uuid(),
  reason: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().min(3, "Informe o motivo da devolução.").max(500),
    ),
});
export type RecordOrderReturnInput = z.input<typeof inputSchema>;

export type RecordOrderReturnResult =
  | {
      ok: true;
      returnId: string;
      refundedInCents: number;
      itemsReturned: number;
      cashAdjustmentId: string | null;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Status que admitem devolução total. Quote (orçamento) e
// canceled/expired não devolvem (nada foi vendido). 'returned' bloqueia
// re-devolução (idempotência).
const RETURNABLE_STATUSES = ["confirmed", "fulfilled"] as const;

export async function recordOrderReturn(
  input: RecordOrderReturnInput,
): Promise<RecordOrderReturnResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const clientCtx = extractClientContext(requestHeaders);

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Verifique os campos.", fieldErrors };
  }
  const data = parsed.data;

  try {
    return await withTenant<RecordOrderReturnResult>(
      store.id,
      userId,
      async (tx) => {
        // 1) Lock por order — serializa contra duplo-clique.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${"order-return-" + data.orderId}))`,
        );

        // 2) Validar order
        const [order] = await tx
          .select({
            id: orderTable.id,
            status: orderTable.status,
            totalInCents: orderTable.totalInCents,
            channel: orderTable.channel,
            customerId: orderTable.customerId,
          })
          .from(orderTable)
          .where(
            and(
              eq(orderTable.id, data.orderId),
              eq(orderTable.storeId, store.id),
            ),
          )
          .limit(1);

        if (!order) return { ok: false, error: "Venda não encontrada." };
        if (!RETURNABLE_STATUSES.includes(order.status as "confirmed" | "fulfilled")) {
          if (order.status === "returned") {
            return {
              ok: false,
              error: "Esta venda já foi devolvida.",
            };
          }
          return {
            ok: false,
            error: `Status '${order.status}' não permite devolução.`,
          };
        }

        // 3) Bloquear se houver receivable pendente associado a esta order.
        //    Devolução com fiado em aberto exigiria estorno separado do
        //    receivable — v1 mantém fluxo simples e força lojista a
        //    quitar/estornar o fiado antes.
        const [pendingReceivable] = await tx
          .select({ id: receivableTable.id })
          .from(receivableTable)
          .where(
            and(
              eq(receivableTable.orderId, data.orderId),
              eq(receivableTable.storeId, store.id),
              isNull(receivableTable.paidAt),
            ),
          )
          .limit(1);
        if (pendingReceivable) {
          return {
            ok: false,
            error:
              "Esta venda tem fiado em aberto. Quite ou estorne o fiado antes de devolver.",
          };
        }

        // 4) Buscar itens da venda
        const items = await tx
          .select({
            id: orderItemTable.id,
            productId: orderItemTable.productId,
            variantId: orderItemTable.variantId,
            quantity: orderItemTable.quantity,
            priceInCentsSnapshot: orderItemTable.priceInCentsSnapshot,
          })
          .from(orderItemTable)
          .where(eq(orderItemTable.orderId, data.orderId));

        if (items.length === 0) {
          return {
            ok: false,
            error: "Venda sem itens — não é possível devolver.",
          };
        }

        // 5) INSERT order_return
        const [returnRow] = await tx
          .insert(orderReturnTable)
          .values({
            storeId: store.id,
            orderId: order.id,
            returnType: "full",
            refundedInCents: order.totalInCents,
            reason: data.reason,
            createdByUserId: userId,
          })
          .returning({ id: orderReturnTable.id });
        if (!returnRow) throw new Error("Falha ao gravar devolução.");

        // 6) INSERT order_return_item — 1 por order_item, qty original total.
        //    Para v1 (full), o refundedInCents per item = price * quantity.
        await tx.insert(orderReturnItemTable).values(
          items.map((it) => ({
            orderReturnId: returnRow.id,
            orderItemId: it.id,
            quantityReturned: it.quantity,
            refundedInCents: it.priceInCentsSnapshot * it.quantity,
          })),
        );

        // 7) Restock — gera stock_movement type='return' por item
        await restockOrderItems(tx as unknown as Tx, order.id, store.id);

        // 8) UPDATE order.status = 'returned'
        await tx
          .update(orderTable)
          .set({ status: "returned" })
          .where(
            and(
              eq(orderTable.id, order.id),
              eq(orderTable.storeId, store.id),
            ),
          );

        // 9) Cash adjustment 'other_out' se há caixa aberto.
        const [activeCash] = await tx
          .select({ id: cashSessionTable.id })
          .from(cashSessionTable)
          .where(
            and(
              eq(cashSessionTable.storeId, store.id),
              sql`${cashSessionTable.closedAt} IS NULL`,
            ),
          )
          .limit(1);

        let cashAdjustmentId: string | null = null;
        if (activeCash) {
          const [adj] = await tx
            .insert(cashAdjustmentTable)
            .values({
              cashSessionId: activeCash.id,
              type: "other_out",
              amountInCents: order.totalInCents,
              reason: `Devolução venda #${order.id.slice(0, 8)} — ${data.reason}`.slice(
                0,
                500,
              ),
              createdByUserId: userId,
            })
            .returning({ id: cashAdjustmentTable.id });
          cashAdjustmentId = adj?.id ?? null;
          // Linka o adjustment ao return pra trilha de auditoria.
          if (cashAdjustmentId) {
            await tx
              .update(orderReturnTable)
              .set({ cashAdjustmentId })
              .where(eq(orderReturnTable.id, returnRow.id));
          }
        }

        // 10) Revalidações
        const storeRow = await tx.query.storeTable.findFirst({
          where: eq(storeTable.id, store.id),
          columns: { slug: true },
        });
        if (storeRow?.slug) revalidateTag(`store-${storeRow.slug}`);
        revalidatePath(`/admin/pedidos`);
        revalidatePath(`/admin/pedidos/${order.id}`);
        revalidatePath("/admin/estoque");
        revalidatePath("/admin/produtos");
        revalidatePath("/admin");
        revalidatePath("/admin/pdv/caixa");
        if (order.customerId) {
          revalidatePath(`/admin/clientes/${order.customerId}`);
        }

        logger.info("order.return_recorded", {
          storeId: store.id,
          orderId: order.id,
          returnId: returnRow.id,
          refundedInCents: order.totalInCents,
          itemsReturned: items.length,
          cashAdjustmentId,
        });

        // Sprint 6A — auditoria forense.
        await recordAuditEvent(tx as unknown as Tx, {
          storeId: store.id,
          actorUserId: userId,
          action: "order.return_recorded",
          entityType: "order",
          entityId: order.id,
          payload: {
            returnId: returnRow.id,
            refundedInCents: order.totalInCents,
            itemsReturned: items.length,
            reason: data.reason,
            cashAdjustmentId,
          },
          ip: clientCtx.ip,
          userAgent: clientCtx.userAgent,
        });

        return {
          ok: true,
          returnId: returnRow.id,
          refundedInCents: order.totalInCents,
          itemsReturned: items.length,
          cashAdjustmentId,
        };
      },
    );
  } catch (e) {
    logger.error("order.record_return_failed", { err: e });
    const msg = e instanceof Error ? e.message : "Falha desconhecida.";
    return { ok: false, error: msg };
  }
}
