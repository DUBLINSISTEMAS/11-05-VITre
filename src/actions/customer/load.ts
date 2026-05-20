"use server";

import { and, count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { customerTable, orderTable } from "@/db/schema";
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

    return { customer, orderCount, recentOrders };
  });
}
