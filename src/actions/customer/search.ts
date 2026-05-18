"use server";

import { and, eq, ilike, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { customerTable,type CustomerType } from "@/db/schema";
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
  if (trimmed.length < 1) {
    // Busca vazia retorna os mais recentes (pra exibir alguma coisa
    // no primeiro foco no combobox)
    return withTenant(store.id, session.user.id, async (tx) => {
      const rows = await tx
        .select({
          id: customerTable.id,
          name: customerTable.name,
          phone: customerTable.phone,
          type: customerTable.type,
          document: customerTable.document,
        })
        .from(customerTable)
        .where(eq(customerTable.storeId, store.id))
        .orderBy(sql`${customerTable.createdAt} DESC`)
        .limit(MAX_RESULTS);
      return rows;
    });
  }

  const safeQ = trimmed.replace(/[\\%_]/g, "\\$&");
  // ADR-0021 — busca por documento usa só dígitos (sem máscara).
  // Se a query for puramente dígitos com tamanho razoável, casamos
  // contra document (normalizado no DB também é só dígitos).
  const queryDigits = normalizeDocument(trimmed);
  const matchesDocument = queryDigits.length >= 3;

  return withTenant(store.id, session.user.id, async (tx) => {
    const where = and(
      eq(customerTable.storeId, store.id),
      or(
        ilike(customerTable.name, `%${safeQ}%`),
        ilike(customerTable.phone, `%${safeQ}%`),
        matchesDocument
          ? ilike(customerTable.document, `%${queryDigits}%`)
          : undefined,
      ),
    );
    const rows = await tx
      .select({
        id: customerTable.id,
        name: customerTable.name,
        phone: customerTable.phone,
        type: customerTable.type,
        document: customerTable.document,
      })
      .from(customerTable)
      .where(where)
      .orderBy(customerTable.name)
      .limit(MAX_RESULTS);
    return rows;
  });
}
