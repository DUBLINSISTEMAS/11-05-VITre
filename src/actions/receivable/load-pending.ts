"use server";

/**
 * loadPendingReceivables — Sprint 2B.
 *
 * Lista todos os fiados pendentes da loja, com info de cliente.
 * Usado em /admin/financeiro/receber.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface PendingReceivableRow {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  orderId: string | null;
  amountInCents: number;
  /** Sprint 4B — soma dos receivable_payment desta linha. */
  paidInCents: number;
  /** Saldo a receber = amountInCents - paidInCents. */
  remainingInCents: number;
  dueDate: Date | null;
  isOverdue: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface PendingReceivablesResult {
  rows: PendingReceivableRow[];
  totals: {
    pendingSum: number;
    overdueSum: number;
    overdueCount: number;
    pendingCount: number;
  };
}

export async function loadPendingReceivables(): Promise<PendingReceivablesResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      rows: [],
      totals: { pendingSum: 0, overdueSum: 0, overdueCount: 0, pendingCount: 0 },
    };
  }
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return {
      rows: [],
      totals: { pendingSum: 0, overdueSum: 0, overdueCount: 0, pendingCount: 0 },
    };
  }

  return withTenant(store.id, session.user.id, async (tx) => {
    // Subquery: SUM(receivable_payment.amount) por receivable_id.
    // LEFT JOIN garante zero pra receivables sem pagamento.
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

    const rows = await tx
      .select({
        id: receivableTable.id,
        customerId: receivableTable.customerId,
        customerName: customerTable.name,
        customerPhone: customerTable.phone,
        orderId: receivableTable.orderId,
        amountInCents: receivableTable.amountInCents,
        paidInCents: sql<number>`coalesce(${paidByReceivable.paid}, 0)`,
        dueDate: receivableTable.dueDate,
        notes: receivableTable.notes,
        createdAt: receivableTable.createdAt,
      })
      .from(receivableTable)
      .innerJoin(
        customerTable,
        eq(customerTable.id, receivableTable.customerId),
      )
      .leftJoin(
        paidByReceivable,
        eq(paidByReceivable.receivableId, receivableTable.id),
      )
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          isNull(receivableTable.paidAt),
        ),
      )
      .orderBy(asc(receivableTable.dueDate));

    // Totais já consideram saldo PARCIALMENTE pago: total pendente real =
    // SUM(amount) - SUM(payments) das receivables abertas.
    const totals = await tx
      .select({
        amountSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}), 0)::int`,
        paidSum: sql<number>`coalesce(sum(${paidByReceivable.paid}), 0)::int`,
        overdueAmountSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.dueDate} < now()), 0)::int`,
        overduePaidSum: sql<number>`coalesce(sum(${paidByReceivable.paid}) filter (where ${receivableTable.dueDate} < now()), 0)::int`,
        overdueCount: sql<number>`count(*) filter (where ${receivableTable.dueDate} < now())::int`,
        pendingCount: sql<number>`count(*)::int`,
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

    const t = totals[0];
    const now = new Date();
    return {
      rows: rows.map((r) => {
        const remainingInCents = Math.max(0, r.amountInCents - r.paidInCents);
        return {
          id: r.id,
          customerId: r.customerId,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          orderId: r.orderId,
          amountInCents: r.amountInCents,
          paidInCents: r.paidInCents,
          remainingInCents,
          dueDate: r.dueDate,
          isOverdue: r.dueDate !== null && r.dueDate < now,
          notes: r.notes,
          createdAt: r.createdAt,
        };
      }),
      totals: {
        pendingSum: (t?.amountSum ?? 0) - (t?.paidSum ?? 0),
        overdueSum: (t?.overdueAmountSum ?? 0) - (t?.overduePaidSum ?? 0),
        overdueCount: t?.overdueCount ?? 0,
        pendingCount: t?.pendingCount ?? 0,
      },
    };
  });
}
