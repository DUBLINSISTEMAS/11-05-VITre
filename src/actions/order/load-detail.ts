"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerTable,
  orderItemTable,
  orderPaymentTable,
  orderReturnItemTable,
  orderReturnTable,
  orderTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  calculateNetProfit,
  type PaymentMethodCategory,
} from "@/lib/pricing/net-profit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type { ORDER_STATUS_VALUES } from "./schema";

const COUNTS_AS_SALE = new Set([
  "confirmed",
  "fulfilled",
  "awaiting_whatsapp",
  "returned",
]);

export type OrderDetailItem = {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  imageUrlSnapshot: string | null;
  priceInCentsSnapshot: number;
  quantity: number;
  /**
   * Sprint 2.1: quantidade já devolvida deste item (acumulado de
   * devoluções parciais + full). Saldo disponível pra nova devolução
   * = quantity - quantityReturned.
   */
  quantityReturned: number;
  /**
   * Onda R3 (2026-05-29) — snapshot do custo unitario no momento da venda
   * (em centavos). NULL quando produto nao tinha custo cadastrado. Usado
   * pelo helper `calculateNetProfit` pra computar CMV histórico.
   */
  unitCostSnapshotInCents: number | null;
  /**
   * Onda R3 — snapshot da comissao TOTAL desta linha (em centavos, ja
   * computada `priceInCents * quantity * commissionBps`). NULL quando
   * a vendedora nao foi atribuida ou produto nao tem commission default.
   */
  commissionSnapshotInCents: number | null;
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

/** Pre-Sprint-6 C — devolução registrada deste order. */
export type OrderDetailReturn = {
  id: string;
  returnType: "full" | "partial";
  refundedInCents: number;
  reason: string;
  createdAt: Date;
};

/**
 * Onda 1.2/1.3 (2026-05-22) — pagamento real do pedido. UMA linha por
 * forma usada (R$80 cash + R$50 pix = 2 linhas). Antes o detalhe lia
 * apenas `order.paymentMethod` legacy (primeira linha), escondendo
 * pagamento misto do lojista e do cliente.
 */
export type OrderDetailPayment = {
  id: string;
  method: "cash" | "pix" | "debit" | "credit" | "other";
  amountInCents: number;
  /** Pra cálculo de troco quando method='cash'. NULL pros outros. */
  cashReceivedInCents: number | null;
  /**
   * Audit 2026-05-26 — número de parcelas no cartão de crédito (SQL 70).
   * 1 = à vista; > 1 só com method='credit'. Drawer exibe "Crédito 3×".
   */
  installments: number;
  notes: string | null;
  /**
   * Onda R3 (2026-05-29) — snapshot da taxa real cobrada pela maquininha
   * em centavos (calculado no INSERT via `computeCardFeeSnapshot`). NULL
   * quando method = cash/pix/fiado/other (sem taxa). Usado pra deduzir
   * no lucro liquido sem ter que recomputar.
   */
  cardFeeSnapshotInCents: number | null;
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
  /** Canal de origem — `balcao` (PDV) ou `whatsapp` (loja online). */
  channel: "whatsapp" | "balcao";
  whatsappOpenedAt: Date | null;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  /** Sprint 1A Fase 4 — validade do orçamento (NULL quando status != quote). */
  quoteValidUntil: Date | null;
  createdAt: Date;
  items: OrderDetailItem[];
  /** Onda 1.3 — multi-pagamento real. Vazio em orçamento/quote ainda sem pagamento. */
  payments: OrderDetailPayment[];
  /** Pre-Sprint-6 C — lista de devoluções (vazia quando venda não foi devolvida). */
  returns: OrderDetailReturn[];
  /**
   * Onda R3 (2026-05-29) — lucro liquido REAL da venda, calculado
   * server-side via helper canonico `calculateNetProfit`. NULL quando o
   * status NAO conta como venda efetiva (quote/canceled/expired).
   */
  netProfitInCents: number | null;
  /** Margem em % (0..100, ou negativa). NULL quando netProfit NULL. */
  netMarginPct: number | null;
  /**
   * 0..100 — cobertura CMV (% itens com custo cadastrado). 100 = lucro
   * totalmente confiavel. <100 = otimista (subestima CMV).
   */
  costCoveragePct: number;
  /** Custo total CMV (snapshot). 0 quando nenhum item tem custo. */
  totalCostInCents: number;
  /** Comissao total (snapshot). 0 quando vendedora nao foi atribuida. */
  totalCommissionInCents: number;
  /** Taxa cartao total (snapshot). 0 quando metodo nao tem taxa (cash/pix). */
  totalCardFeeInCents: number;
};

export type LoadOrderDetailResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; error: string };

/**
 * Carrega detalhe completo do pedido sob demanda (Onda 4, 2026-05-12).
 * Usado pelo OrderDetailDrawer — substitui a rota /admin/pedidos/[id].
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

  // Onda M2 (2026-05-29) — paralelizado. Antes eram 6 queries series
  // (order + items + returnedQuantities + payments + linkedCustomer +
  // returns) somando ~6 round-trips. Em rede mediana isso dava ~600-800ms
  // e o Suspense React 19 podia abortar silenciosamente o load do drawer
  // (founder reportou loading travado em orcamento PDV). Agora: 1 query
  // base (order) + 4 queries dependentes em Promise.all + 1 condicional
  // pra linkedCustomer. Total: 1 + max(4 paralelas) + 1 = 3 round-trips.
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

    // 4 queries paralelas — todas dependem so de orderId + storeId,
    // ja resolvidos. Promise.all aproveita o pool de conexoes do withTenant.
    const [items, returnedQuantities, payments, returns] = await Promise.all([
      tx
        .select({
          id: orderItemTable.id,
          productNameSnapshot: orderItemTable.productNameSnapshot,
          variantNameSnapshot: orderItemTable.variantNameSnapshot,
          imageUrlSnapshot: orderItemTable.imageUrlSnapshot,
          priceInCentsSnapshot: orderItemTable.priceInCentsSnapshot,
          quantity: orderItemTable.quantity,
          // Onda R3 — snapshots de custo e comissao por linha.
          unitCostSnapshotInCents: orderItemTable.unitCostSnapshotInCents,
          commissionSnapshotInCents: orderItemTable.commissionSnapshotInCents,
        })
        .from(orderItemTable)
        .where(eq(orderItemTable.orderId, orderId)),

      // Sprint 2.1 — acumulado de quantidade ja devolvida por order_item.
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

      // Onda 1.3 — multi-pagamento real. Ordenado por createdAt ASC.
      tx
        .select({
          id: orderPaymentTable.id,
          method: orderPaymentTable.method,
          amountInCents: orderPaymentTable.amountInCents,
          cashReceivedInCents: orderPaymentTable.cashReceivedInCents,
          installments: orderPaymentTable.installments,
          notes: orderPaymentTable.notes,
          // Onda R3 — snapshot de taxa cartao por pagamento.
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

      // Pre-Sprint-6 C — carrega devolucoes (geralmente 0 ou 1).
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

    // linkedCustomer fica fora do Promise.all porque depende de
    // order.customerId (so resolvido). Round-trip extra so paga quando
    // o pedido tem cliente cadastrado vinculado (orcamento PDV avulso
    // nao tem — pula direto).
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

    const itemsWithReturned: OrderDetailItem[] = items.map((it) => ({
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

  if (!result) return { ok: false, error: "Pedido não encontrado." };

  // Onda R3 — calcular lucro liquido usando snapshots ja gravados.
  // Helper canonico. Quando status nao conta como venda, retorna NULL
  // pra UI esconder a celula.
  const { totalCostInCents, totalCommissionInCents, totalCardFeeInCents,
    qtyTotal, qtyWithCost } = result.items.reduce(
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
      totalCardFeeInCents: 0,
      qtyTotal: 0,
      qtyWithCost: 0,
    },
  );
  const cardFeeSum = result.payments.reduce(
    (s, p) => s + (p.cardFeeSnapshotInCents ?? 0),
    0,
  );
  const totalCardFee = cardFeeSum;
  const costCoveragePct =
    qtyTotal === 0 ? 0 : Math.round((qtyWithCost / qtyTotal) * 100);

  let netProfitInCents: number | null = null;
  let netMarginPct: number | null = null;
  if (COUNTS_AS_SALE.has(result.order.status)) {
    // Helper consome snapshots: cardFee + commission ja calculados em
    // centavos, entao passamos paymentMethod="other" pra zerar recalculo
    // e somamos manualmente abaixo.
    const calc = calculateNetProfit({
      revenueInCents: result.order.totalInCents,
      costInCents: totalCostInCents,
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
      calc.netProfitInCents - totalCardFee - totalCommissionInCents;
    netMarginPct =
      result.order.totalInCents > 0
        ? (netProfitInCents / result.order.totalInCents) * 100
        : 0;
  }

  return {
    ok: true,
    order: {
      ...result.order,
      status: result.order.status as (typeof ORDER_STATUS_VALUES)[number],
      channel: result.order.channel as "whatsapp" | "balcao",
      items: result.items,
      payments: result.payments,
      linkedCustomer: result.linkedCustomer,
      returns: result.returns,
      // Onda R3
      netProfitInCents,
      netMarginPct,
      costCoveragePct,
      totalCostInCents,
      totalCommissionInCents,
      totalCardFeeInCents: totalCardFee,
    },
  };
}
