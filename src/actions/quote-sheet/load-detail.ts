"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";

import { quoteSheetTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type QuoteSheetDetail = {
  id: string;
  shortCode: string;
  customerName: string;
  customerPhone: string | null;
  customerDocument: string | null;
  customerCity: string | null;
  receivedAt: Date | null;
  deliveryAt: Date | null;
  description: string;
  totalInCents: number;
  downPaymentInCents: number;
  downPaymentNote: string | null;
  remainderInCents: number;
  noticeText: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LoadQuoteSheetResult =
  | { ok: true; quoteSheet: QuoteSheetDetail }
  | { ok: false; error: string };

/**
 * Carrega detalhe de uma ficha por ID. Filtra deleted_at IS NULL
 * (soft-delete some até de "arquivados"). Usado pela página de edição
 * e pela rota de impressão.
 */
export async function loadQuoteSheetDetail(
  id: string,
): Promise<LoadQuoteSheetResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada." };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const row = await withTenant(store.id, session.user.id, async (tx) => {
    return tx.query.quoteSheetTable.findFirst({
      where: and(
        eq(quoteSheetTable.id, id),
        eq(quoteSheetTable.storeId, store.id),
        isNull(quoteSheetTable.deletedAt),
      ),
      columns: {
        id: true,
        shortCode: true,
        customerName: true,
        customerPhone: true,
        customerDocument: true,
        customerCity: true,
        receivedAt: true,
        deliveryAt: true,
        description: true,
        totalInCents: true,
        downPaymentInCents: true,
        downPaymentNote: true,
        remainderInCents: true,
        noticeText: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  if (!row) return { ok: false, error: "Ficha não encontrada." };
  return { ok: true, quoteSheet: row };
}
