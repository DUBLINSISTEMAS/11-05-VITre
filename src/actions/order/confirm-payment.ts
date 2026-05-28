"use server";

/**
 * Registra pagamento de uma venda EXISTENTE (Onda 36 — 2026-05-28).
 *
 * Fecha o gap do checkout WhatsApp: `create-from-cart.ts` cria a order
 * mas NÃO grava order_payment (cliente paga fora — PIX, transferência,
 * cartão na hora da entrega). Sem este registro, o snapshot de taxa
 * real e settlement_date some, DRE/dashboard ficam cegos pro canal
 * WhatsApp.
 *
 * Idempotência hard: só registra se `order_payment` da order estiver
 * vazia. Lojista que registrou errado precisa cancelar a venda e
 * lançar de novo (não há "editar pagamento" ainda — escopo MVP).
 *
 * Mesma rota de snapshots do PDV (create-balcao-sale.ts:1180):
 *   - `computeCardFeeSnapshot` usa store.card_real_fee_bps_*
 *   - `computeSettlementDate` usa store.settlement_days_*
 * Single source of truth — bug em 1 lugar, fix em 1 lugar.
 */
import { and, eq, sum } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { orderPaymentTable, orderTable, storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  computeCardFeeSnapshot,
  computeSettlementDate,
} from "@/lib/pricing/net-profit";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import {
  type ConfirmOrderPaymentInput,
  confirmOrderPaymentSchema,
} from "./schema";

export type ConfirmOrderPaymentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const STATUSES_THAT_ACCEPT_PAYMENT = new Set([
  // venda WhatsApp recém-criada: aceita lançar pagamento adiantado.
  "awaiting_whatsapp",
  // lojista confirmou — fluxo principal.
  "confirmed",
  // venda entregue sem ter registrado pagamento: regularização posterior.
  "fulfilled",
]);

export async function confirmOrderPayment(
  input: ConfirmOrderPaymentInput,
): Promise<ConfirmOrderPaymentResult> {
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

  const parsed = confirmOrderPaymentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  const { orderId, payments } = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, async (tx) => {
      // 1. Carrega order + valida ownership + status. RLS já filtra,
      //    WHERE storeId explícito = defesa em profundidade.
      const order = await tx.query.orderTable.findFirst({
        where: and(
          eq(orderTable.id, orderId),
          eq(orderTable.storeId, store.id),
        ),
        columns: { id: true, status: true, totalInCents: true },
      });
      if (!order) {
        return { ok: false as const, error: "Venda não encontrada." };
      }
      if (!STATUSES_THAT_ACCEPT_PAYMENT.has(order.status)) {
        return {
          ok: false as const,
          error:
            "Esta venda não aceita registro de pagamento agora (status " +
            order.status +
            ").",
        };
      }

      // 2. Idempotência hard: só permite registrar se NÃO há linha de
      //    pagamento ainda. Lojista que errou precisa cancelar a venda
      //    e lançar de novo (sem UI de edit nesta onda).
      const existing = await tx
        .select({ total: sum(orderPaymentTable.amountInCents) })
        .from(orderPaymentTable)
        .where(
          and(
            eq(orderPaymentTable.orderId, orderId),
            eq(orderPaymentTable.storeId, store.id),
          ),
        );
      const existingTotal = Number(existing[0]?.total ?? 0);
      if (existingTotal > 0) {
        return {
          ok: false as const,
          error: "Pagamento já foi registrado pra esta venda.",
        };
      }

      // 3. Soma das linhas tem que bater com totalInCents da order.
      //    Diferente do PDV (que aceita desconto/acréscimo modificáveis),
      //    aqui o total da venda já está congelado.
      const sumPayments = payments.reduce(
        (acc, p) => acc + p.amountInCents,
        0,
      );
      if (sumPayments !== order.totalInCents) {
        return {
          ok: false as const,
          error:
            "A soma das formas de pagamento (R$ " +
            (sumPayments / 100).toFixed(2) +
            ") precisa bater com o total da venda (R$ " +
            (order.totalInCents / 100).toFixed(2) +
            ").",
        };
      }

      // 4. Carrega taxas + settlement days da loja pra snapshot.
      //    storeRow é a única forma de garantir os campos novos (SQL 76 + 82)
      //    em vez de confiar no cache de getCurrentStore.
      const storeRow = await tx.query.storeTable.findFirst({
        where: eq(storeTable.id, store.id),
        columns: {
          cardRealFeeBpsDebit: true,
          cardRealFeeBpsCredit1x: true,
          cardRealFeeBpsCredit2xTo6x: true,
          cardRealFeeBpsCredit7xTo12x: true,
          settlementDaysPix: true,
          settlementDaysDebit: true,
          settlementDaysCredit: true,
        },
      });
      if (!storeRow) {
        // Inalcançável (já validamos `store` acima), mas defesa em profundidade.
        return { ok: false as const, error: "Loja não encontrada." };
      }

      // 5. INSERT com snapshots calculados a partir do storeRow.
      //    Mesmo padrão de create-balcao-sale.ts:1180.
      const paymentCreatedAt = new Date();
      await tx.insert(orderPaymentTable).values(
        payments.map((p) => ({
          storeId: store.id,
          orderId: order.id,
          method: p.method,
          amountInCents: p.amountInCents,
          cashReceivedInCents: p.cashReceivedInCents,
          installments: p.installments,
          notes: p.notes,
          cardFeeSnapshotInCents: computeCardFeeSnapshot(
            p.amountInCents,
            p.method,
            p.installments,
            storeRow,
          ),
          settlementDate: computeSettlementDate(
            paymentCreatedAt,
            p.method,
            storeRow,
          ),
        })),
      );

      logger.info("order.payment_confirmed", {
        storeId: store.id,
        orderId: order.id,
        lines: payments.length,
        total: order.totalInCents,
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    // 6. Revalida caches afetados. Drawer recarrega via revalidatePath
    //    da própria rota do drawer (admin shell).
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");
    revalidatePath(`/admin/pedidos/${orderId}`);
    const storeRow = await getCurrentStore(userId);
    if (storeRow?.slug) revalidateTag(`store-${storeRow.slug}`);

    return { ok: true };
  } catch (err) {
    logger.error("order.payment_confirm_failed", {
      orderId,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: "Erro ao registrar pagamento. Tente novamente.",
    };
  }
}
