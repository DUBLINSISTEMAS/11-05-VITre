"use server";

/**
 * loadReceivableDetail — Sprint 4B.
 *
 * Carrega 1 receivable + customer + order info + lista completa de
 * pagamentos (append-only). Saldo restante = amount - SUM(payments).
 *
 * Usado pelo dialog "Receber pagamento" em /admin/financeiro/receber e
 * pela página de detalhe do cliente (drilldown).
 *
 * Retorna `null` se o receivable não pertence à loja — defesa contra URL
 * hacking (RLS já bloqueia, mas devolvemos null controlado em vez de
 * stack trace).
 */
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerTable,
  orderTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface ReceivablePaymentRow {
  id: string;
  amountInCents: number;
  method: "cash" | "pix" | "debit" | "credit" | "other";
  notes: string | null;
  createdAt: Date;
}

export interface ReceivableDetail {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  orderId: string | null;
  orderShortCode: string | null;
  amountInCents: number;
  paidInCents: number;
  remainingInCents: number;
  dueDate: Date | null;
  paidAt: Date | null;
  paidMethod:
    | "cash"
    | "pix"
    | "debit"
    | "credit"
    | "other"
    | null;
  isOverdue: boolean;
  notes: string | null;
  createdAt: Date;
  payments: ReceivablePaymentRow[];
}

export async function loadReceivableDetail(
  receivableId: string,
): Promise<ReceivableDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const [row] = await tx
      .select({
        id: receivableTable.id,
        customerId: receivableTable.customerId,
        customerName: customerTable.name,
        customerPhone: customerTable.phone,
        orderId: receivableTable.orderId,
        orderShortCode: orderTable.shortCode,
        amountInCents: receivableTable.amountInCents,
        dueDate: receivableTable.dueDate,
        paidAt: receivableTable.paidAt,
        paidMethod: receivableTable.paidMethod,
        notes: receivableTable.notes,
        createdAt: receivableTable.createdAt,
      })
      .from(receivableTable)
      .innerJoin(customerTable, eq(customerTable.id, receivableTable.customerId))
      .leftJoin(orderTable, eq(orderTable.id, receivableTable.orderId))
      .where(
        and(
          eq(receivableTable.id, receivableId),
          eq(receivableTable.storeId, store.id),
        ),
      )
      .limit(1);

    if (!row) return null;

    const payments = await tx
      .select({
        id: receivablePaymentTable.id,
        amountInCents: receivablePaymentTable.amountInCents,
        method: receivablePaymentTable.method,
        notes: receivablePaymentTable.notes,
        createdAt: receivablePaymentTable.createdAt,
      })
      .from(receivablePaymentTable)
      .where(eq(receivablePaymentTable.receivableId, receivableId))
      .orderBy(asc(receivablePaymentTable.createdAt));

    const paidInCents = payments.reduce((acc, p) => acc + p.amountInCents, 0);
    const remainingInCents = Math.max(0, row.amountInCents - paidInCents);
    const now = new Date();
    const isOverdue =
      row.paidAt === null && row.dueDate !== null && row.dueDate < now;

    return {
      ...row,
      paidInCents,
      remainingInCents,
      isOverdue,
      payments,
    };
  });
}
