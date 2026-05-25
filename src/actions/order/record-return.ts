"use server";

/**
 * recordOrderReturn — Pre-Sprint-6 C + Sprint 2.1 + Sprint 2.2 (2026-05-22).
 *
 * Registra devolução de venda balcão. Suporta:
 *   - `full`: cliente trouxe TUDO de volta. order.status vira 'returned'.
 *   - `partial`: cliente trouxe alguns itens. order.status só vira
 *     'returned' se a soma das partials acumuladas igualar a qty
 *     vendida de TODOS os itens. Senão fica como estava (confirmed
 *     ou fulfilled) e admite novas devoluções parciais.
 *
 * Regras de coexistência:
 *   - `full` exclui qualquer devolução posterior (UNIQUE no DB).
 *   - `partial` exclui `full` posterior (nada sobrou pra full devolver
 *     no caso geral). Permite mais partials até esgotar.
 *
 * Fluxo:
 *   1. Validar order (existe, é da loja, status permite devolução).
 *   2. Validar que NÃO há receivable pendente vinculado ao order. Pra
 *      Sprint 2.2: em vez de erro técnico, devolve errorCode
 *      'PENDING_RECEIVABLE' + receivableId + remainingInCents, pra UI
 *      guiar o lojista a estornar primeiro.
 *   3. Pra partial: validar que cada (orderItemId, quantity) cabe no
 *      saldo do item (qty vendida - qty já devolvida acumulada).
 *   4. Inserir order_return + order_return_item por linha devolvida.
 *   5. INSERT stock_movements type='return' (full = restockOrderItems,
 *      partial = restockOrderItemsPartial).
 *   6. UPDATE order.status = 'returned' se devolveu tudo, senão mantém.
 *   7. INSERT cash_adjustment 'other_out' se houver caixa aberto
 *      (valor proporcional à devolução).
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
  orderPaymentTable,
  orderReturnItemTable,
  orderReturnTable,
  orderTable,
  receivablePaymentTable,
  receivableTable,
  storeTable,
} from "@/db/schema";
import { extractClientContext, recordAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  restockOrderItems,
  restockOrderItemsPartial,
} from "@/lib/order/restock";
import { formatBRL } from "@/lib/pricing";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { type Tx, withTenant } from "@/lib/tenant";

import { isReturnable } from "./constants";

// Sprint 2.1 — schema aceita full ou partial. Full ignora items.
// Partial exige items non-empty com qty positivo.
const inputSchema = z
  .object({
    orderId: z.string().uuid(),
    returnType: z.enum(["full", "partial"]).default("full"),
    items: z
      .array(
        z.object({
          orderItemId: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .optional(),
    reason: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().min(3, "Informe o motivo da devolução.").max(500),
    ),
  })
  .refine(
    (v) =>
      v.returnType === "full" ||
      (Array.isArray(v.items) && v.items.length > 0),
    {
      message: "Devolução parcial exige ao menos um item.",
      path: ["items"],
    },
  );
export type RecordOrderReturnInput = z.input<typeof inputSchema>;

export type RecordOrderReturnResult =
  | {
      ok: true;
      returnId: string;
      returnType: "full" | "partial";
      refundedInCents: number;
      /**
       * Sprint flash 2026-05-24 — fração CASH do refund que saiu do
       * caixa físico. Antes debitávamos refundedInCents inteiro mesmo
       * em venda paga em PIX/cartão (quebrava caixa). Agora calculamos
       * proporcionalmente à fração cash da venda ORIGINAL. UI usa pra
       * informar lojista quando estorno PIX/cartão precisa ser feito
       * fora do sistema.
       *
       * cashRefundInCents == refundedInCents → 100% cash (default antigo)
       * cashRefundInCents == 0               → venda foi 100% pix/cartão/fiado
       * 0 < cashRefundInCents < refundedInCents → venda mista
       */
      cashRefundInCents: number;
      itemsReturned: number;
      cashAdjustmentId: string | null;
      /** true se a devolução fechou o saldo da venda → order.status='returned'. */
      orderFullyReturned: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  // Sprint 2.2 — caso especial pra UI guiar o lojista a estornar fiado.
  | {
      ok: false;
      errorCode: "PENDING_RECEIVABLE";
      error: string;
      receivableId: string;
      remainingInCents: number;
    };

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
        if (!isReturnable(order.status)) {
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

        // 3) Sprint 2.2 — receivable pendente vira fluxo guiado (não
        //    erro técnico). Retorna errorCode + receivableId pra UI
        //    chamar reverseReceivablePayment e voltar. `remainingInCents`
        //    é calculado: amountInCents - sum(receivable_payment).
        const [pendingReceivable] = await tx
          .select({
            id: receivableTable.id,
            amountInCents: receivableTable.amountInCents,
            paidInCents: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`,
          })
          .from(receivableTable)
          .leftJoin(
            receivablePaymentTable,
            eq(receivablePaymentTable.receivableId, receivableTable.id),
          )
          .where(
            and(
              eq(receivableTable.orderId, data.orderId),
              eq(receivableTable.storeId, store.id),
              isNull(receivableTable.paidAt),
            ),
          )
          .groupBy(receivableTable.id, receivableTable.amountInCents)
          .limit(1);
        if (pendingReceivable) {
          const remainingInCents = Math.max(
            0,
            pendingReceivable.amountInCents - pendingReceivable.paidInCents,
          );
          return {
            ok: false,
            errorCode: "PENDING_RECEIVABLE" as const,
            error:
              "Esta venda tem fiado em aberto. Estorne o fiado antes de devolver.",
            receivableId: pendingReceivable.id,
            remainingInCents,
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
            // Sprint flash 2026-05-24 — mensagens de erro precisam
            // referenciar produto pelo NOME (não UUID truncado).
            productNameSnapshot: orderItemTable.productNameSnapshot,
            variantNameSnapshot: orderItemTable.variantNameSnapshot,
          })
          .from(orderItemTable)
          .where(eq(orderItemTable.orderId, data.orderId));

        if (items.length === 0) {
          return {
            ok: false,
            error: "Venda sem itens — não é possível devolver.",
          };
        }

        // 5) Sprint 2.1 — saldo já devolvido por item (acumulado de
        //    devoluções parciais anteriores). Inclui devoluções parciais
        //    apenas (full não pode coexistir com partial — UNIQUE no DB).
        const previousReturns = await tx
          .select({
            orderItemId: orderReturnItemTable.orderItemId,
            quantityReturned: orderReturnItemTable.quantityReturned,
          })
          .from(orderReturnItemTable)
          .innerJoin(
            orderReturnTable,
            eq(orderReturnTable.id, orderReturnItemTable.orderReturnId),
          )
          .where(eq(orderReturnTable.orderId, order.id));

        const alreadyReturnedByItem = new Map<string, number>();
        for (const r of previousReturns) {
          alreadyReturnedByItem.set(
            r.orderItemId,
            (alreadyReturnedByItem.get(r.orderItemId) ?? 0) +
              r.quantityReturned,
          );
        }
        const hasPreviousPartial = previousReturns.length > 0;

        // 6) Calcular o que vai ser devolvido nesta operação.
        //    - full: todos os items com qty=quantity restante (mas se
        //      hasPreviousPartial, full é proibido — usa partial).
        //    - partial: items do input validados contra saldo.
        const itemsById = new Map(items.map((it) => [it.id, it]));
        let toReturn: Array<{
          orderItemId: string;
          quantity: number;
          refundedInCents: number;
        }> = [];

        if (data.returnType === "full") {
          if (hasPreviousPartial) {
            return {
              ok: false,
              error:
                "Esta venda já teve devolução parcial. Use devolução parcial pra continuar devolvendo.",
            };
          }
          toReturn = items.map((it) => ({
            orderItemId: it.id,
            quantity: it.quantity,
            refundedInCents: it.priceInCentsSnapshot * it.quantity,
          }));
        } else {
          // partial
          for (const reqItem of data.items ?? []) {
            const orig = itemsById.get(reqItem.orderItemId);
            if (!orig) {
              return {
                ok: false,
                error: "Item solicitado não pertence a esta venda.",
              };
            }
            const alreadyReturned =
              alreadyReturnedByItem.get(reqItem.orderItemId) ?? 0;
            const available = orig.quantity - alreadyReturned;
            if (reqItem.quantity > available) {
              // Sprint flash 2026-05-24 — usa nome legível em vez de
              // UUID truncado (lojista não tem como mapear `a3f2b8e1`
              // pra peça nenhuma; toda mensagem voltada pra UI deve
              // referenciar produtos por nome snapshot).
              const itemName = orig.variantNameSnapshot
                ? `${orig.productNameSnapshot} (${orig.variantNameSnapshot})`
                : orig.productNameSnapshot;
              return {
                ok: false,
                error: `Item "${itemName}": tentando devolver ${reqItem.quantity}, saldo disponível ${available}.`,
              };
            }
            toReturn.push({
              orderItemId: reqItem.orderItemId,
              quantity: reqItem.quantity,
              refundedInCents: orig.priceInCentsSnapshot * reqItem.quantity,
            });
          }
          if (toReturn.length === 0) {
            return {
              ok: false,
              error: "Nenhum item válido pra devolver.",
            };
          }
        }

        const refundedInCents = toReturn.reduce(
          (acc, t) => acc + t.refundedInCents,
          0,
        );

        // 7) Verificar se a devolução fecha o saldo (todos items zerados).
        const willBeReturnedByItem = new Map(alreadyReturnedByItem);
        for (const t of toReturn) {
          willBeReturnedByItem.set(
            t.orderItemId,
            (willBeReturnedByItem.get(t.orderItemId) ?? 0) + t.quantity,
          );
        }
        const orderFullyReturned = items.every(
          (it) => (willBeReturnedByItem.get(it.id) ?? 0) >= it.quantity,
        );

        // 8) INSERT order_return. Pra parciais, mantém returnType='partial'
        //    mesmo se esta operação esgotar o saldo — preserva o histórico
        //    de "como aconteceu" (3 devoluções parciais em sequência).
        //    UNIQUE INDEX no DB garante: no máximo 1 full por order, e
        //    full + partial são mutuamente excludentes pela regra acima.
        const [returnRow] = await tx
          .insert(orderReturnTable)
          .values({
            storeId: store.id,
            orderId: order.id,
            returnType: data.returnType,
            refundedInCents,
            reason: data.reason,
            createdByUserId: userId,
          })
          .returning({ id: orderReturnTable.id });
        if (!returnRow) throw new Error("Falha ao gravar devolução.");

        // 9) INSERT order_return_item — uma linha por item devolvido.
        await tx.insert(orderReturnItemTable).values(
          toReturn.map((t) => ({
            orderReturnId: returnRow.id,
            orderItemId: t.orderItemId,
            quantityReturned: t.quantity,
            refundedInCents: t.refundedInCents,
          })),
        );

        // 10) Restock — full usa helper antigo (todos os items na qty
        //     vendida original), partial usa o novo helper com qty
        //     específica por item.
        if (data.returnType === "full") {
          await restockOrderItems(tx as unknown as Tx, order.id, store.id);
        } else {
          await restockOrderItemsPartial(
            tx as unknown as Tx,
            order.id,
            store.id,
            toReturn.map((t) => ({
              orderItemId: t.orderItemId,
              quantity: t.quantity,
            })),
          );
        }

        // 11) UPDATE order.status. Vira 'returned' apenas quando a venda
        //     foi totalmente devolvida (full direto, OU partials que
        //     esgotaram o saldo). Senão fica como estava — admite mais
        //     devoluções parciais futuras.
        if (orderFullyReturned) {
          await tx
            .update(orderTable)
            .set({ status: "returned" })
            .where(
              and(
                eq(orderTable.id, order.id),
                eq(orderTable.storeId, store.id),
              ),
            );
        }

        // 12) Cash adjustment 'other_out' PROPORCIONAL à fração CASH da
        //     venda original.
        //
        // Sprint flash 2026-05-24 — bug crítico de caixa: antes
        // debitávamos `refundedInCents` inteiro como saída de dinheiro,
        // mesmo quando a venda foi paga em PIX/cartão/fiado. Cliente que
        // pagou PIX e devolve produto → gaveta perdia R$X que nunca
        // recebeu. Estorno de cartão zerava caixa no mesmo dia
        // (operadora demora 30d). Agora: lê `order_payment` da venda
        // original, calcula a fração cash, debita proporcional.
        //
        // Casos:
        //   - venda 100% cash       → cashRefund = refundedInCents
        //   - venda 100% pix/cartão → cashRefund = 0 (NÃO toca caixa)
        //   - venda mista 60/40     → cashRefund = refunded * 0.6
        //   - venda fiada           → cashRefund = 0 (não tem payment)
        //
        // Math.round arredonda half-up (centavo perdido vai pra "lucro
        // de borda" da loja). Aceitável: devoluções são raras e o erro
        // máximo é 1 centavo por linha.
        const originalPayments = await tx
          .select({
            method: orderPaymentTable.method,
            amountInCents: orderPaymentTable.amountInCents,
          })
          .from(orderPaymentTable)
          .where(eq(orderPaymentTable.orderId, order.id));

        const originalTotalPaidInCents = originalPayments.reduce(
          (s, p) => s + p.amountInCents,
          0,
        );
        const originalCashInCents = originalPayments
          .filter((p) => p.method === "cash")
          .reduce((s, p) => s + p.amountInCents, 0);
        const cashFraction =
          originalTotalPaidInCents > 0
            ? originalCashInCents / originalTotalPaidInCents
            : 0;
        const cashRefundInCents = Math.round(refundedInCents * cashFraction);

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
        if (activeCash && cashRefundInCents > 0) {
          const adjReasonPrefix =
            data.returnType === "full"
              ? "Devolução"
              : "Devolução parcial";
          // Se a venda foi mista, anota no motivo que parte saiu fora do
          // caixa pra forensia ser fácil ("ué, esses R$30 que faltam?").
          const fracionalSuffix =
            cashRefundInCents < refundedInCents
              ? ` (refund total ${formatBRL(refundedInCents)} — parte PIX/cartão fora do caixa)`
              : "";
          const reason =
            `${adjReasonPrefix} venda #${order.id.slice(0, 8)} — ${data.reason}${fracionalSuffix}`.slice(
              0,
              500,
            );
          const [adj] = await tx
            .insert(cashAdjustmentTable)
            .values({
              cashSessionId: activeCash.id,
              type: "other_out",
              amountInCents: cashRefundInCents,
              reason,
              createdByUserId: userId,
            })
            .returning({ id: cashAdjustmentTable.id });
          cashAdjustmentId = adj?.id ?? null;
          if (cashAdjustmentId) {
            await tx
              .update(orderReturnTable)
              .set({ cashAdjustmentId })
              .where(eq(orderReturnTable.id, returnRow.id));
          }
        }

        // 13) Revalidações
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
          returnType: data.returnType,
          refundedInCents,
          cashRefundInCents,
          originalCashFraction: cashFraction,
          itemsReturned: toReturn.length,
          orderFullyReturned,
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
            returnType: data.returnType,
            refundedInCents,
            itemsReturned: toReturn.length,
            orderFullyReturned,
            reason: data.reason,
            cashAdjustmentId,
          },
          ip: clientCtx.ip,
          userAgent: clientCtx.userAgent,
        });

        return {
          ok: true,
          returnId: returnRow.id,
          returnType: data.returnType,
          refundedInCents,
          cashRefundInCents,
          itemsReturned: toReturn.length,
          cashAdjustmentId,
          orderFullyReturned,
        };
      },
    );
  } catch (e) {
    logger.error("order.record_return_failed", { err: e });
    const msg = e instanceof Error ? e.message : "Falha desconhecida.";
    return { ok: false, error: msg };
  }
}
