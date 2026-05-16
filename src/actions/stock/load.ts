"use server";

import { and, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";

import {
  productTable,
  productVariantTable,
  type StockMovement,
  stockMovementTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface StockMovementRow {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  movementType: StockMovement["movementType"];
  quantityDelta: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface ListMovementsParams {
  q?: string;
  movementType?: StockMovement["movementType"] | null;
  page?: number;
  pageSize?: number;
}

export interface ListMovementsResult {
  items: StockMovementRow[];
  total: number;
}

/**
 * Lista movimentações de estoque do tenant atual com filtros (Fase 4 —
 * ADR-0015). Server function pra ser chamada pelo page.tsx do admin.
 *
 * Filtros:
 *   - q:           busca por nome de produto/variant (ilike)
 *   - movementType: enum filter
 *   - page/pageSize: paginação
 */
export async function listStockMovements(
  params: ListMovementsParams = {},
): Promise<ListMovementsResult> {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], total: 0 };

  const pageSize = Math.max(1, Math.min(params.pageSize ?? 30, 100));
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * pageSize;

  return withTenant(store.id, session.user.id, async (tx) => {
    const conditions: SQL[] = [eq(stockMovementTable.storeId, store.id)];

    if (params.movementType) {
      conditions.push(eq(stockMovementTable.movementType, params.movementType));
    }

    // Busca por nome — exige resolver productIds que batem antes
    if (params.q) {
      const safeQ = params.q.replace(/[\\%_]/g, "\\$&");
      const matchingProducts = await tx
        .select({ id: productTable.id })
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            ilike(productTable.name, `%${safeQ}%`),
          ),
        )
        .limit(200);
      const productIds = matchingProducts.map((p) => p.id);
      if (productIds.length === 0) {
        return { items: [], total: 0 };
      }
      conditions.push(inArray(stockMovementTable.productId, productIds));
    }

    const where = and(...conditions);

    const totalRows = await tx
      .select({ value: count() })
      .from(stockMovementTable)
      .where(where);
    const total = totalRows[0]?.value ?? 0;

    if (total === 0) return { items: [], total: 0 };

    const rows = await tx
      .select({
        id: stockMovementTable.id,
        productId: stockMovementTable.productId,
        productName: productTable.name,
        variantId: stockMovementTable.variantId,
        variantName: productVariantTable.name,
        movementType: stockMovementTable.movementType,
        quantityDelta: stockMovementTable.quantityDelta,
        referenceType: stockMovementTable.referenceType,
        referenceId: stockMovementTable.referenceId,
        notes: stockMovementTable.notes,
        createdAt: stockMovementTable.createdAt,
      })
      .from(stockMovementTable)
      .leftJoin(productTable, eq(stockMovementTable.productId, productTable.id))
      .leftJoin(
        productVariantTable,
        eq(stockMovementTable.variantId, productVariantTable.id),
      )
      .where(where)
      .orderBy(desc(stockMovementTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items: StockMovementRow[] = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.productName ?? "(produto removido)",
      variantId: r.variantId,
      variantName: r.variantName,
      movementType: r.movementType,
      quantityDelta: r.quantityDelta,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      notes: r.notes,
      createdAt: r.createdAt,
    }));

    return { items, total };
  });
}

// Re-export pra outros lugares que precisarem do tipo
export type { StockMovement };
// Avoid unused import warning when gte/lte added later for date filtering
void gte;
void lte;
void or;
