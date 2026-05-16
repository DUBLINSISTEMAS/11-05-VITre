"use server";

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { orderTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type PaymentMethodKey =
  | "cash"
  | "pix"
  | "debit"
  | "credit"
  | "other"
  | "unknown";

export interface DaySummaryByMethod {
  method: PaymentMethodKey;
  count: number;
  total: number; // soma de total_in_cents
}

export interface DaySummary {
  /** ISO yyyy-mm-dd da janela. */
  date: string;
  byMethod: DaySummaryByMethod[];
  totalCount: number;
  totalCents: number;
}

/**
 * Resumo de vendas balcão do dia agrupado por método de pagamento.
 * Usado pela página "Fechar caixa" (/admin/pdv/caixa) — follow-up Fase 5.
 *
 * Janela: 00:00 → 23:59:59.999 do dia escolhido, no fuso do server
 * (Vercel UTC). Diferença de até 3h pra fuso BR — aceitável pra
 * fechamento de caixa, founder revisa visualmente.
 */
export async function loadBalcaoDaySummary(params: {
  date?: string; // yyyy-mm-dd
}): Promise<DaySummary | null> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  // Resolve a janela
  const now = new Date();
  const target = params.date ? new Date(`${params.date}T00:00:00`) : now;
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const dayStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    0,
    0,
    0,
    0,
  );
  const dayEnd = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    23,
    59,
    59,
    999,
  );

  const iso = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;

  return withTenant(store.id, session.user.id, async (tx) => {
    const rows = await tx
      .select({
        method: orderTable.paymentMethod,
        count: sql<string>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(${orderTable.totalInCents}), 0)`,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.channel, "balcao"),
          gte(orderTable.createdAt, dayStart),
          lte(orderTable.createdAt, dayEnd),
        ),
      )
      .groupBy(orderTable.paymentMethod)
      .orderBy(asc(orderTable.paymentMethod));

    const byMethod: DaySummaryByMethod[] = rows.map((r) => ({
      method: (r.method ?? "unknown") as PaymentMethodKey,
      count: Number(r.count),
      total: Number(r.total),
    }));

    const totalCount = byMethod.reduce((s, r) => s + r.count, 0);
    const totalCents = byMethod.reduce((s, r) => s + r.total, 0);

    return { date: iso, byMethod, totalCount, totalCents };
  });
}
