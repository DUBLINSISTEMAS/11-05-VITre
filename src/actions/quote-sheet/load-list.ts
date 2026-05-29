"use server";

import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { headers } from "next/headers";

import { quoteSheetTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type QuoteSheetListRow = {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string | null;
  totalInCents: number;
  downPaymentInCents: number;
  remainderInCents: number;
  deliveryAt: Date | null;
  createdAt: Date;
};

export type LoadQuoteSheetListInput = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type LoadQuoteSheetListResult = {
  rows: QuoteSheetListRow[];
  total: number;
};

/**
 * Lista fichas de orçamento da loja. Filtra deleted_at + archived_at IS NULL
 * (default — arquivados são pra histórico, fora da listagem comum).
 *
 * Sem aba "expirados/ativos" (como no orçamento PDV) — ficha balcão não
 * tem validade configurada; vive até o cliente decidir.
 */
export async function loadQuoteSheetList(
  input: LoadQuoteSheetListInput = {},
): Promise<LoadQuoteSheetListResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return { rows: [], total: 0 };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { rows: [], total: 0 };

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const q = (input.q ?? "").trim();

  const conditions = [
    eq(quoteSheetTable.storeId, store.id),
    isNull(quoteSheetTable.deletedAt),
    isNull(quoteSheetTable.archivedAt),
  ];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    conditions.push(
      or(
        ilike(quoteSheetTable.customerName, `%${safeQ}%`),
        ilike(quoteSheetTable.shortCode, `%${safeQ}%`),
      )!,
    );
  }

  return withTenant(store.id, session.user.id, async (tx) => {
    const whereClause = and(...conditions);

    const totalRow = await tx
      .select({ n: count() })
      .from(quoteSheetTable)
      .where(whereClause);
    const total = Number(totalRow[0]?.n ?? 0);

    const rows = await tx
      .select({
        id: quoteSheetTable.id,
        shortCode: quoteSheetTable.shortCode,
        customerName: quoteSheetTable.customerName,
        customerPhone: quoteSheetTable.customerPhone,
        totalInCents: quoteSheetTable.totalInCents,
        downPaymentInCents: quoteSheetTable.downPaymentInCents,
        remainderInCents: quoteSheetTable.remainderInCents,
        deliveryAt: quoteSheetTable.deliveryAt,
        createdAt: quoteSheetTable.createdAt,
      })
      .from(quoteSheetTable)
      .where(whereClause)
      .orderBy(desc(quoteSheetTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { rows, total };
  });
}
