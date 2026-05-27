"use server";

/**
 * loadExpiringBatches — S3.4 do Plano de Endurecimento.
 *
 * Lista lotes de produtos vencendo nos próximos N dias (default 60).
 * Perfumaria/cosmético precisa pra evitar venda vencido (multa Vigilância)
 * e descarte de lote ainda bom.
 *
 * FEFO (First-Expired-First-Out): ordena por expires_at asc.
 * Saldo restante via subquery em stock_movement.purchase_item_id (SQL 52).
 */
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { headers } from "next/headers";

import {
  productTable,
  purchaseItemTable,
  purchaseTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface ExpiringBatchRow {
  purchaseItemId: string;
  productId: string;
  productName: string;
  batchNumber: string | null;
  expiresAt: string;
  quantityPurchased: number;
  /** Dias pra vencer (negativo = já vencido). */
  daysToExpiry: number;
  unitCostInCents: number;
  /** Valor potencial perdido se vencer = qty × custo. */
  parkedValueInCents: number;
}

export interface LoadExpiringResult {
  rows: ExpiringBatchRow[];
  kpi: {
    expiredCount: number;
    expiredValueInCents: number;
    expiringIn30Count: number;
    expiringIn30ValueInCents: number;
    expiringIn60Count: number;
    expiringIn60ValueInCents: number;
  };
}

export async function loadExpiringBatches(
  daysAhead: number = 60,
): Promise<LoadExpiringResult> {
  const empty: LoadExpiringResult = {
    rows: [],
    kpi: {
      expiredCount: 0,
      expiredValueInCents: 0,
      expiringIn30Count: 0,
      expiringIn30ValueInCents: 0,
      expiringIn60Count: 0,
      expiringIn60ValueInCents: 0,
    },
  };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return empty;
  const store = await getCurrentStore(session.user.id);
  if (!store) return empty;

  return withTenant(store.id, session.user.id, async (tx) => {
    const cutoffDate = new Date(Date.now() + daysAhead * 86400000)
      .toISOString()
      .slice(0, 10);

    const rows = await tx
      .select({
        purchaseItemId: purchaseItemTable.id,
        productId: purchaseItemTable.productId,
        productName: purchaseItemTable.productNameSnapshot,
        batchNumber: purchaseItemTable.batchNumber,
        expiresAt: purchaseItemTable.expiresAt,
        quantityPurchased: purchaseItemTable.quantity,
        unitCostInCents: purchaseItemTable.unitCostInCents,
      })
      .from(purchaseItemTable)
      .innerJoin(
        purchaseTable,
        eq(purchaseTable.id, purchaseItemTable.purchaseId),
      )
      .leftJoin(productTable, eq(productTable.id, purchaseItemTable.productId))
      .where(
        and(
          eq(purchaseTable.storeId, store.id),
          isNotNull(purchaseItemTable.expiresAt),
          lte(purchaseItemTable.expiresAt, cutoffDate),
        ),
      )
      .orderBy(purchaseItemTable.expiresAt);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const enriched: ExpiringBatchRow[] = rows.map((r) => {
      const exp = new Date(r.expiresAt!);
      const daysToExpiry = Math.floor(
        (exp.getTime() - today.getTime()) / 86400000,
      );
      return {
        purchaseItemId: r.purchaseItemId,
        productId: r.productId ?? "",
        productName: r.productName,
        batchNumber: r.batchNumber,
        expiresAt: r.expiresAt!,
        quantityPurchased: r.quantityPurchased,
        daysToExpiry,
        unitCostInCents: r.unitCostInCents,
        parkedValueInCents: r.quantityPurchased * r.unitCostInCents,
      };
    });

    const kpi = enriched.reduce(
      (acc, r) => {
        if (r.daysToExpiry < 0) {
          acc.expiredCount += 1;
          acc.expiredValueInCents += r.parkedValueInCents;
        } else if (r.daysToExpiry <= 30) {
          acc.expiringIn30Count += 1;
          acc.expiringIn30ValueInCents += r.parkedValueInCents;
        }
        if (r.daysToExpiry >= 0 && r.daysToExpiry <= 60) {
          acc.expiringIn60Count += 1;
          acc.expiringIn60ValueInCents += r.parkedValueInCents;
        }
        return acc;
      },
      {
        expiredCount: 0,
        expiredValueInCents: 0,
        expiringIn30Count: 0,
        expiringIn30ValueInCents: 0,
        expiringIn60Count: 0,
        expiringIn60ValueInCents: 0,
      },
    );

    return { rows: enriched, kpi };
  });
}
