"use server";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { customerTable, orderTable, receivableTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import type { CustomerDetail } from "./types";

/**
 * Reads do domínio `customer` para client components (forms client-side
 * de edição, combobox de vínculo em pedido). Prefixo `load*` por
 * convenção CLAUDE.md #3: server actions que são leituras puras, NÃO
 * mutações.
 */

/**
 * Carrega detalhe do cliente + bloco "Últimos pedidos" (max 10).
 * Retorna `null` se cliente não pertence à loja do user (defesa contra
 * URL hacking — RLS bloqueia, mas devolvemos `null` controlado em vez
 * de stack trace).
 */
export async function loadCustomerDetail(
  customerId: string,
): Promise<CustomerDetail | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const customer = await tx.query.customerTable.findFirst({
      where: and(
        eq(customerTable.id, customerId),
        eq(customerTable.storeId, store.id),
      ),
    });
    if (!customer) return null;

    // Série dentro do tx — `pg` deprecou paralelas no mesmo client.
    const totalRows = await tx
      .select({ value: count() })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.customerId, customerId),
        ),
      );
    const orderCount = totalRows[0]?.value ?? 0;

    const recentOrders = await tx
      .select({
        id: orderTable.id,
        shortCode: orderTable.shortCode,
        totalInCents: orderTable.totalInCents,
        status: orderTable.status,
        createdAt: orderTable.createdAt,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.customerId, customerId),
        ),
      )
      .orderBy(desc(orderTable.createdAt))
      .limit(10);

    // Sprint 2B — agregados de fiado (receivable) deste cliente.
    const receivableAgg = await tx
      .select({
        pendingSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.paidAt} is null), 0)::int`,
        overdueSum: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (where ${receivableTable.paidAt} is null and ${receivableTable.dueDate} < now()), 0)::int`,
        overdueCount: sql<number>`count(*) filter (where ${receivableTable.paidAt} is null and ${receivableTable.dueDate} < now())::int`,
        pendingCount: sql<number>`count(*) filter (where ${receivableTable.paidAt} is null)::int`,
      })
      .from(receivableTable)
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          eq(receivableTable.customerId, customerId),
        ),
      );
    const r = receivableAgg[0];
    const fiadoSummary = {
      pendingSum: r?.pendingSum ?? 0,
      overdueSum: r?.overdueSum ?? 0,
      overdueCount: r?.overdueCount ?? 0,
      pendingCount: r?.pendingCount ?? 0,
    };

    // Linhas de receivable pendentes (mais recentes 20). Pagas ficam fora
    // pra reduzir scroll — UI tem botão "Ver pagos" pra detalhe maior.
    const pendingReceivables = await tx
      .select({
        id: receivableTable.id,
        amountInCents: receivableTable.amountInCents,
        dueDate: receivableTable.dueDate,
        paidAt: receivableTable.paidAt,
        orderId: receivableTable.orderId,
        notes: receivableTable.notes,
        createdAt: receivableTable.createdAt,
      })
      .from(receivableTable)
      .where(
        and(
          eq(receivableTable.storeId, store.id),
          eq(receivableTable.customerId, customerId),
          isNull(receivableTable.paidAt),
        ),
      )
      .orderBy(desc(receivableTable.dueDate))
      .limit(20);

    return {
      customer,
      orderCount,
      recentOrders,
      fiadoSummary,
      pendingReceivables,
    };
  });
}
