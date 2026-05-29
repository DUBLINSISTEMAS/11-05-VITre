"use server";

/**
 * loadFinanceiroOverview — Onda L2 (2026-05-29).
 *
 * KPIs da tela `/admin/financeiro` que respondem a pergunta-mae:
 * "Quanto entrou, quanto saiu, e quanto sobrou ESTE MES?"
 *
 * 4 numeros:
 *   1. recebidoMesInCents     — soma de receivable_payment.amount_in_cents
 *                                com paid_at dentro do mes corrente
 *   2. pagoMesInCents         — soma de expense.amount_in_cents com paid_at
 *                                dentro do mes corrente
 *   3. saldoMesInCents        — recebidoMes − pagoMes (pode ser negativo)
 *   4. pendenteReceberInCents — saldo aberto de fiados (amount − payments)
 *   5. pendenteParagarInCents — soma de expense.amount_in_cents nao pagas
 *
 * Mes corrente = primeiro dia 00:00 ate ultimo dia 23:59:59 (timezone local
 * do servidor — Brasil). Sem filtro de periodo externo: foco e "hoje vs
 * historico". Periodos customizados ficam nos relatorios.
 *
 * Performance: 4 SUMs em transacao unica via withTenant. Total ~20ms em
 * loja media.
 */
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  expenseTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface FinanceiroOverview {
  recebidoMesInCents: number;
  pagoMesInCents: number;
  saldoMesInCents: number;
  pendenteReceberInCents: number;
  pendentePagarInCents: number;
  mesLabel: string;
}

function monthBounds(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const label = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

export async function loadFinanceiroOverview(): Promise<FinanceiroOverview> {
  const session = await auth.api.getSession({ headers: await headers() });
  const empty: FinanceiroOverview = {
    recebidoMesInCents: 0,
    pagoMesInCents: 0,
    saldoMesInCents: 0,
    pendenteReceberInCents: 0,
    pendentePagarInCents: 0,
    mesLabel: "",
  };
  if (!session?.user) return empty;
  const store = await getCurrentStore(session.user.id);
  if (!store) return empty;

  const { start, end, label } = monthBounds();
  // Expense usa `paid_at date` (sem time). Comparacao usa YYYY-MM-DD
  // string. Compatibilidade: drizzle aceita Date e converte.
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  return withTenant(store.id, session.user.id, async (tx) => {
    // 1. Recebido este mes = SUM(receivable_payment.amount) onde created_at
    //    no mes. `receivable_payment` NAO tem coluna `paid_at` — cada linha
    //    e o ato de receber em si, marcado pelo createdAt do insert (Sprint
    //    4B append-only). Quem tem paid_at e o `receivable` agregador
    //    (derivado quando SUM(payments) >= amount).
    const [recebidoRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`,
      })
      .from(receivablePaymentTable)
      .where(
        and(
          eq(receivablePaymentTable.storeId, store.id),
          gte(receivablePaymentTable.createdAt, start),
          lte(receivablePaymentTable.createdAt, end),
        ),
      );

    // 2. Pago este mes = SUM(expense.amount) onde paid_at no mes
    const [pagoRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${expenseTable.amountInCents}), 0)::int`,
      })
      .from(expenseTable)
      .where(
        and(
          eq(expenseTable.storeId, store.id),
          sql`${expenseTable.paidAt} >= ${startIso}`,
          sql`${expenseTable.paidAt} <= ${endIso}`,
        ),
      );

    // 3. Pendente a receber = SUM(receivable.amount) − SUM(receivable_payment)
    //    pra receivables abertas (paid_at IS NULL).
    const paidByReceivable = tx
      .select({
        receivableId: receivablePaymentTable.receivableId,
        paid: sql<number>`coalesce(sum(${receivablePaymentTable.amountInCents}), 0)::int`.as(
          "paid",
        ),
      })
      .from(receivablePaymentTable)
      .where(eq(receivablePaymentTable.storeId, store.id))
      .groupBy(receivablePaymentTable.receivableId)
      .as("paid_by_receivable");

    const [pendenteReceberRow] = await tx
      .select({
        amount: sql<number>`coalesce(sum(${receivableTable.amountInCents}), 0)::int`,
        paid: sql<number>`coalesce(sum(${paidByReceivable.paid}), 0)::int`,
      })
      .from(receivableTable)
      .leftJoin(
        paidByReceivable,
        eq(paidByReceivable.receivableId, receivableTable.id),
      )
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          isNull(receivableTable.paidAt),
        ),
      );

    // 4. Pendente a pagar = SUM(expense.amount) onde paid_at IS NULL
    const [pendentePagarRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${expenseTable.amountInCents}), 0)::int`,
      })
      .from(expenseTable)
      .where(
        and(
          eq(expenseTable.storeId, store.id),
          isNull(expenseTable.paidAt),
        ),
      );

    const recebidoMes = recebidoRow?.total ?? 0;
    const pagoMes = pagoRow?.total ?? 0;
    const pendenteReceber =
      (pendenteReceberRow?.amount ?? 0) - (pendenteReceberRow?.paid ?? 0);
    const pendentePagar = pendentePagarRow?.total ?? 0;

    return {
      recebidoMesInCents: recebidoMes,
      pagoMesInCents: pagoMes,
      saldoMesInCents: recebidoMes - pagoMes,
      pendenteReceberInCents: Math.max(0, pendenteReceber),
      pendentePagarInCents: pendentePagar,
      mesLabel: label,
    };
  });
}
