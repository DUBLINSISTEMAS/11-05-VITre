"use server";

/**
 * loadPendingReceivables — Sprint 2B.
 *
 * Lista todos os fiados pendentes da loja, com info de cliente.
 * Usado em /admin/financeiro/receber.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { customerTable, receivableTable } from "@/db/schema";
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
    const rows = await tx
      .select({
        id: receivableTable.id,
        customerId: receivableTable.customerId,
        customerName: customerTable.name,
        customerPhone: customerTable.phone,
        orderId: receivableTable.orderId,
        amountInCents: receivableTable.amountInCents,
        dueDate: receivableTable.dueDate,
        notes: receivableTable.notes,
        createdAt: receivableTable.createdAt,
      })
      .from(receivableTable)
      .innerJoin(
        customerTable,
        eq(customerTable.id, receivableTable.customerId),
      )
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          isNull(receivableTable.paidAt),
        ),
      )
      .orderBy(asc(receivableTable.dueDate));

    const totals = await tx
      .select({
        pendingSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}), 0)::int`,
        overdueSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.dueDate} < now()), 0)::int`,
        overdueCount: sql<number>`count(*) filter (where ${receivableTable.dueDate} < now())::int`,
        pendingCount: sql<number>`count(*)::int`,
      })
      .from(receivableTable)
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          isNull(receivableTable.paidAt),
        ),
      );

    const now = new Date();
    return {
      rows: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        orderId: r.orderId,
        amountInCents: r.amountInCents,
        dueDate: r.dueDate,
        isOverdue: r.dueDate !== null && r.dueDate < now,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
      totals: totals[0] ?? {
        pendingSum: 0,
        overdueSum: 0,
        overdueCount: 0,
        pendingCount: 0,
      },
    };
  });
}
