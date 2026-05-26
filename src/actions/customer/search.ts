"use server";

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  customerGroupTable,
  type CustomerPricingTier,
  customerTable,
  type CustomerType,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeDocument } from "@/lib/document";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_RESULTS = 8;

export interface CustomerSearchHit {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  document: string | null;
  /**
   * Sprint 3.2: notas internas do cliente. PDV usa pra mostrar badge
   * "📝 anotação" antes da operadora liberar fiado (ex: "deve há 3 meses").
   * Trim no app pra evitar enviar texto longo nas listas (cap 500 chars
   * já vem do DB CHECK).
   */
  notes: string | null;
  /**
   * Sprint 5.4: tier de pricing herdado do grupo do cliente. Quando
   * 'wholesale', PDV aplica `product.wholesale_price_in_cents` ao
   * adicionar itens (fallback no preço normal se NULL). NULL quando
   * cliente não tem grupo ou grupo é 'regular'.
   */
  groupPricingTier: CustomerPricingTier | null;
  /** Sprint 5.4 — nome do grupo do cliente (pra badge na UI). */
  groupName: string | null;
  /**
   * Audit 2026-05-26 — saldo fiado em aberto deste cliente em centavos.
   * Soma `receivable.amount_in_cents − Σ receivable_payment.amount_in_cents`
   * de receivables com `paid_at IS NULL`. PDV renderiza badge "Fiado: R$ X"
   * no card do cliente vinculado pra operadora ver inadimplência ANTES de
   * liberar mais venda fiada. 0 = sem saldo em aberto.
   */
  creditOutstandingInCents: number;
}

/**
 * Busca rápida de clientes pra combobox de vínculo em pedido (ADR-0014
 * — vínculo follow-up). Read-only, sem rate limit (autenticado + escopado
 * pela loja via RLS). Match em name ilike + phone ilike, escape de wildcards.
 *
 * Limite hardcoded em 8 resultados — combobox não precisa de paginação,
 * lojista refina busca se sobrar muita coisa.
 */
export async function searchCustomers(
  q: string,
): Promise<CustomerSearchHit[]> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return [];

  const store = await getCurrentStore(session.user.id);
  if (!store) return [];

  const trimmed = q.trim();
  const safeQ = trimmed.replace(/[\\%_]/g, "\\$&");
  // ADR-0021 — busca por documento usa só dígitos (sem máscara).
  // Se a query for puramente dígitos com tamanho razoável, casamos
  // contra document (normalizado no DB também é só dígitos).
  const queryDigits = normalizeDocument(trimmed);
  const matchesDocument = queryDigits.length >= 3;

  return withTenant(store.id, session.user.id, async (tx) => {
    const baseRows =
      trimmed.length < 1
        ? await tx
            .select({
              id: customerTable.id,
              name: customerTable.name,
              phone: customerTable.phone,
              type: customerTable.type,
              document: customerTable.document,
              notes: customerTable.notes,
              groupPricingTier: customerGroupTable.defaultPricingTier,
              groupName: customerGroupTable.name,
            })
            .from(customerTable)
            .leftJoin(
              customerGroupTable,
              eq(customerGroupTable.id, customerTable.groupId),
            )
            .where(eq(customerTable.storeId, store.id))
            .orderBy(sql`${customerTable.createdAt} DESC`)
            .limit(MAX_RESULTS)
        : await tx
            .select({
              id: customerTable.id,
              name: customerTable.name,
              phone: customerTable.phone,
              type: customerTable.type,
              document: customerTable.document,
              notes: customerTable.notes,
              groupPricingTier: customerGroupTable.defaultPricingTier,
              groupName: customerGroupTable.name,
            })
            .from(customerTable)
            .leftJoin(
              customerGroupTable,
              eq(customerGroupTable.id, customerTable.groupId),
            )
            .where(
              and(
                eq(customerTable.storeId, store.id),
                or(
                  ilike(customerTable.name, `%${safeQ}%`),
                  ilike(customerTable.phone, `%${safeQ}%`),
                  matchesDocument
                    ? ilike(customerTable.document, `%${queryDigits}%`)
                    : undefined,
                ),
              ),
            )
            .orderBy(customerTable.name)
            .limit(MAX_RESULTS);

    if (baseRows.length === 0) return [];

    // Audit 2026-05-26 — 1 query batch agregando saldo fiado em aberto por
    // customer. `receivable.amount_in_cents − Σ receivable_payment.amount`
    // somado pra cada cliente que TEM receivable com paid_at IS NULL.
    // LEFT JOIN porque o cliente pode ter receivable sem nenhum payment.
    // Sem N+1: 1 query independente do tamanho de baseRows.
    const customerIds = baseRows.map((r) => r.id);
    const creditRows = await tx
      .select({
        customerId: receivableTable.customerId,
        outstanding: sql<string>`
          COALESCE(SUM(${receivableTable.amountInCents}), 0)
          - COALESCE(SUM(
              CASE WHEN ${receivablePaymentTable.id} IS NULL THEN 0
                   ELSE ${receivablePaymentTable.amountInCents}
              END
            ), 0)
        `,
      })
      .from(receivableTable)
      .leftJoin(
        receivablePaymentTable,
        eq(receivablePaymentTable.receivableId, receivableTable.id),
      )
      .where(
        and(
          inArray(receivableTable.customerId, customerIds),
          sql`${receivableTable.paidAt} IS NULL`,
        ),
      )
      .groupBy(receivableTable.customerId);

    const outstandingByCustomerId = new Map<string, number>();
    for (const r of creditRows) {
      if (r.customerId) {
        const v = Number(r.outstanding);
        if (v > 0) outstandingByCustomerId.set(r.customerId, v);
      }
    }

    return baseRows.map((row) => ({
      ...row,
      creditOutstandingInCents: outstandingByCustomerId.get(row.id) ?? 0,
    }));
  });
}
