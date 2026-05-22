"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  type CashAdjustment,
  cashAdjustmentTable,
  type CashSession,
  cashSessionTable,
  orderTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type { CashSessionListRow, CashSessionSummary } from "./types";

/**
 * Reads do domínio cash-session. Prefixo `load*` (CLAUDE.md #3) — sem
 * side-effects. Server actions usadas por dialogs/pages client.
 */

/**
 * Carrega sessão ATIVA da loja (se houver) + agregados.
 * Retorna null quando nenhuma sessão aberta.
 */
export async function loadActiveCashSession(): Promise<CashSessionSummary | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const [active] = await tx
      .select()
      .from(cashSessionTable)
      .where(
        and(
          eq(cashSessionTable.storeId, store.id),
          isNull(cashSessionTable.closedAt),
        ),
      )
      .limit(1);

    if (!active) return null;

    return computeSummary(tx, active);
  });
}

/**
 * Carrega sessão por ID (aberta ou fechada). Retorna null se não pertence
 * à loja do usuário (RLS bloqueia naturalmente, esta camada apenas
 * formaliza o null em vez de retornar undefined).
 */
export async function loadCashSessionDetail(
  sessionId: string,
): Promise<
  | (CashSessionSummary & {
      adjustments: CashAdjustment[];
      sales: CashSessionSaleRow[];
    })
  | null
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const [target] = await tx
      .select()
      .from(cashSessionTable)
      .where(
        and(
          eq(cashSessionTable.id, sessionId),
          eq(cashSessionTable.storeId, store.id),
        ),
      )
      .limit(1);

    if (!target) return null;

    const summary = await computeSummary(tx, target);

    const adjustments = await tx
      .select()
      .from(cashAdjustmentTable)
      .where(eq(cashAdjustmentTable.cashSessionId, target.id))
      .orderBy(desc(cashAdjustmentTable.createdAt));

    const sales = await tx
      .select({
        id: orderTable.id,
        shortCode: orderTable.shortCode,
        totalInCents: orderTable.totalInCents,
        paymentMethod: orderTable.paymentMethod,
        createdAt: orderTable.createdAt,
        customerName: orderTable.customerName,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.cashSessionId, target.id),
          eq(orderTable.channel, "balcao"),
        ),
      )
      .orderBy(desc(orderTable.createdAt));

    return {
      ...summary,
      adjustments,
      sales,
    };
  });
}

/**
 * Lista histórica de sessões (incluindo a ativa). Ordenado por openedAt
 * desc. Limite default 30 — caixa diário típico.
 */
export async function loadCashSessionsList(limit = 30): Promise<
  CashSessionListRow[]
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return [];

  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  return withTenant(store.id, session.user.id, async (tx) => {
    return tx
      .select({
        id: cashSessionTable.id,
        openedAt: cashSessionTable.openedAt,
        closedAt: cashSessionTable.closedAt,
        openingAmountInCents: cashSessionTable.openingAmountInCents,
        closingActualInCents: cashSessionTable.closingActualInCents,
      })
      .from(cashSessionTable)
      .where(eq(cashSessionTable.storeId, store.id))
      .orderBy(desc(cashSessionTable.openedAt))
      .limit(limit);
  });
}

interface CashSessionSaleRow {
  id: string;
  shortCode: string;
  totalInCents: number;
  paymentMethod: string | null;
  createdAt: Date;
  customerName: string | null;
}

type AnyTx = Parameters<
  Parameters<typeof withTenant<CashSessionSummary>>[2]
>[0];

/**
 * Calcula agregados (vendas cash + 6 tipos de adjustment, esperado).
 * Helper compartilhado entre loadActive e loadDetail.
 *
 * Onda 1.2 (2026-05-21): adjustments agora rodam em UMA query agregada
 * com CASE WHEN por tipo (substituiu 2 queries separadas que ignoravam
 * 4 dos 6 tipos do enum). Defesa contra "quebra de caixa fantasma":
 * `other_in` de recebimento de fiado em dinheiro agora soma; PIX não
 * entra (corrigido em receivable/record-payment.ts).
 */
async function computeSummary(
  tx: AnyTx,
  s: CashSession,
): Promise<CashSessionSummary> {
  const [salesAgg] = await tx
    .select({
      totalCash: sql<string | null>`SUM(CASE WHEN ${orderTable.paymentMethod} = 'cash' THEN ${orderTable.totalInCents} ELSE 0 END)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(orderTable)
    .where(
      and(
        eq(orderTable.cashSessionId, s.id),
        eq(orderTable.channel, "balcao"),
      ),
    );
  const cashSalesInCents = Number(salesAgg?.totalCash ?? 0);
  const saleCount = Number(salesAgg?.count ?? 0);

  const [adjAgg] = await tx
    .select({
      sangria: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'sangria' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
      reinforcement: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'reinforcement' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
      paySupplier: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'pay_supplier' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
      payBill: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'pay_bill' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
      otherIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'other_in' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
      otherOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashAdjustmentTable.type} = 'other_out' THEN ${cashAdjustmentTable.amountInCents} ELSE 0 END), 0)`,
    })
    .from(cashAdjustmentTable)
    .where(eq(cashAdjustmentTable.cashSessionId, s.id));

  const sangriaInCents = Number(adjAgg?.sangria ?? 0);
  const reinforcementInCents = Number(adjAgg?.reinforcement ?? 0);
  const paySupplierInCents = Number(adjAgg?.paySupplier ?? 0);
  const payBillInCents = Number(adjAgg?.payBill ?? 0);
  const otherInInCents = Number(adjAgg?.otherIn ?? 0);
  const otherOutInCents = Number(adjAgg?.otherOut ?? 0);

  const inflowsInCents = reinforcementInCents + otherInInCents;
  const outflowsInCents =
    sangriaInCents + paySupplierInCents + payBillInCents + otherOutInCents;

  const expectedInCents =
    s.openingAmountInCents +
    cashSalesInCents +
    inflowsInCents -
    outflowsInCents;

  return {
    session: s,
    cashSalesInCents,
    sangriaInCents,
    paySupplierInCents,
    payBillInCents,
    otherOutInCents,
    reinforcementInCents,
    otherInInCents,
    expectedInCents,
    saleCount,
  };
}
