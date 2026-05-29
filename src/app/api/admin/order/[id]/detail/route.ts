/**
 * GET /api/admin/order/[id]/detail — Onda M2.1 (2026-05-29).
 *
 * Substituto HTTP do server action `loadOrderDetail`. Founder relatou que
 * o drawer de orcamento PDV travava em "Carregando" eternamente mesmo
 * apos M2 ter paralelizado as queries. Telemetria capturou: server
 * respondia em ~1.5s mas o client useEffect NUNCA recebia a resposta.
 *
 * Diagnostico: bug conhecido de Turbopack + React 19 + Server Action em
 * useEffect — request server-side completa mas o client fetch (interno
 * ao Next) e silenciosamente abortado por HMR/cancellation race. Sem
 * erro, sem stack, sem retry.
 *
 * Fix robusto: Route Handler HTTP normal. Client faz fetch comum, com
 * AbortController, sem mágica RSC. Funciona em dev (Turbopack) E em
 * prod (Vercel) com comportamento previsível.
 *
 * Mantem a mesma lógica e schema da action (load-detail.ts) — só muda
 * o transport. RLS, withTenant, paralelizacao M2 preservados.
 *
 * RESPONSE:
 *   200 + body { ok: true, order: OrderDetail }
 *   401 + body { ok: false, error: string }     (sem sessao)
 *   404 + body { ok: false, error: string }     (pedido nao encontrado)
 *   500 + body { ok: false, error: string }     (erro server)
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import type { OrderDetail } from "@/actions/order/load-detail";
import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import {
  customerTable,
  orderItemTable,
  orderPaymentTable,
  orderReturnItemTable,
  orderReturnTable,
  orderTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  calculateNetProfit,
  type PaymentMethodCategory,
} from "@/lib/pricing/net-profit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const COUNTS_AS_SALE = new Set([
  "confirmed",
  "fulfilled",
  "awaiting_whatsapp",
  "returned",
]);

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const startedAt = performance.now();
  const { id: orderId } = await params;

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Sessão expirada." },
      { status: 401 },
    );
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Loja não encontrada." },
      { status: 401 },
    );
  }

  try {
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
          channel: true,
          whatsappOpenedAt: true,
          confirmedAt: true,
          expiresAt: true,
          quoteValidUntil: true,
          createdAt: true,
        },
      });
      if (!order) return null;

      // Paralelizacao M2 mantida — 4 queries simultaneas.
      const [items, returnedQuantities, payments, returns] = await Promise.all([
        tx
          .select({
            id: orderItemTable.id,
            productNameSnapshot: orderItemTable.productNameSnapshot,
            variantNameSnapshot: orderItemTable.variantNameSnapshot,
            imageUrlSnapshot: orderItemTable.imageUrlSnapshot,
            priceInCentsSnapshot: orderItemTable.priceInCentsSnapshot,
            quantity: orderItemTable.quantity,
            // Onda R3 — snapshots pra calcular lucro liquido.
            unitCostSnapshotInCents: orderItemTable.unitCostSnapshotInCents,
            commissionSnapshotInCents: orderItemTable.commissionSnapshotInCents,
          })
          .from(orderItemTable)
          .where(eq(orderItemTable.orderId, orderId)),

        tx
          .select({
            orderItemId: orderReturnItemTable.orderItemId,
            totalReturned: sql<number>`coalesce(sum(${orderReturnItemTable.quantityReturned}), 0)::int`,
          })
          .from(orderReturnItemTable)
          .innerJoin(
            orderReturnTable,
            eq(orderReturnTable.id, orderReturnItemTable.orderReturnId),
          )
          .where(
            and(
              eq(orderReturnTable.orderId, orderId),
              eq(orderReturnTable.storeId, store.id),
            ),
          )
          .groupBy(orderReturnItemTable.orderItemId),

        tx
          .select({
            id: orderPaymentTable.id,
            method: orderPaymentTable.method,
            amountInCents: orderPaymentTable.amountInCents,
            cashReceivedInCents: orderPaymentTable.cashReceivedInCents,
            installments: orderPaymentTable.installments,
            notes: orderPaymentTable.notes,
            cardFeeSnapshotInCents: orderPaymentTable.cardFeeSnapshotInCents,
          })
          .from(orderPaymentTable)
          .where(
            and(
              eq(orderPaymentTable.orderId, orderId),
              eq(orderPaymentTable.storeId, store.id),
            ),
          )
          .orderBy(asc(orderPaymentTable.createdAt)),

        tx
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
          .orderBy(desc(orderReturnTable.createdAt)),
      ]);

      const returnedByItem = new Map<string, number>(
        returnedQuantities.map((r) => [r.orderItemId, r.totalReturned]),
      );

      let linkedCustomer: OrderDetail["linkedCustomer"] = null;
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

      const itemsWithReturned = items.map((it) => ({
        ...it,
        quantityReturned: returnedByItem.get(it.id) ?? 0,
      }));

      return {
        order,
        items: itemsWithReturned,
        payments,
        linkedCustomer,
        returns,
      };
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Pedido não encontrado." },
        { status: 404 },
      );
    }

    const elapsed = Math.round(performance.now() - startedAt);
    if (elapsed > 2000) {
      logger.warn("api.order.detail_slow", { orderId, elapsedMs: elapsed });
    }

    // Onda R3 — agrega cost/commission/cardFee + calcula lucro liquido.
    const profitAgg = result.items.reduce(
      (acc, it) => {
        const cost = it.unitCostSnapshotInCents ?? 0;
        const commission = it.commissionSnapshotInCents ?? 0;
        acc.totalCostInCents += cost * it.quantity;
        acc.totalCommissionInCents += commission;
        acc.qtyTotal += it.quantity;
        if (it.unitCostSnapshotInCents !== null) {
          acc.qtyWithCost += it.quantity;
        }
        return acc;
      },
      {
        totalCostInCents: 0,
        totalCommissionInCents: 0,
        qtyTotal: 0,
        qtyWithCost: 0,
      },
    );
    const totalCardFeeInCents = result.payments.reduce(
      (s, p) => s + (p.cardFeeSnapshotInCents ?? 0),
      0,
    );
    const costCoveragePct =
      profitAgg.qtyTotal === 0
        ? 0
        : Math.round((profitAgg.qtyWithCost / profitAgg.qtyTotal) * 100);

    let netProfitInCents: number | null = null;
    let netMarginPct: number | null = null;
    if (COUNTS_AS_SALE.has(result.order.status)) {
      const calc = calculateNetProfit({
        revenueInCents: result.order.totalInCents,
        costInCents: profitAgg.totalCostInCents,
        paymentMethod: "other" as PaymentMethodCategory,
        installments: 1,
        commissionBps: 0,
        taxBps: 0,
        storeFees: {
          cardRealFeeBpsDebit: store.cardRealFeeBpsDebit,
          cardRealFeeBpsCredit1x: store.cardRealFeeBpsCredit1x,
          cardRealFeeBpsCredit2xTo6x: store.cardRealFeeBpsCredit2xTo6x,
          cardRealFeeBpsCredit7xTo12x: store.cardRealFeeBpsCredit7xTo12x,
        },
      });
      netProfitInCents =
        calc.netProfitInCents - totalCardFeeInCents - profitAgg.totalCommissionInCents;
      netMarginPct =
        result.order.totalInCents > 0
          ? (netProfitInCents / result.order.totalInCents) * 100
          : 0;
    }

    const orderDetail: OrderDetail = {
      ...result.order,
      status: result.order.status as (typeof ORDER_STATUS_VALUES)[number],
      channel: result.order.channel as "whatsapp" | "balcao",
      items: result.items,
      payments: result.payments,
      linkedCustomer: result.linkedCustomer,
      returns: result.returns,
      // Onda R3 — fields novos.
      netProfitInCents,
      netMarginPct,
      costCoveragePct,
      totalCostInCents: profitAgg.totalCostInCents,
      totalCommissionInCents: profitAgg.totalCommissionInCents,
      totalCardFeeInCents,
    };

    return NextResponse.json({ ok: true, order: orderDetail });
  } catch (e) {
    const elapsed = Math.round(performance.now() - startedAt);
    logger.error("api.order.detail_failed", {
      err: e,
      orderId,
      elapsedMs: elapsed,
    });
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar a venda. Tente novamente." },
      { status: 500 },
    );
  }
}
