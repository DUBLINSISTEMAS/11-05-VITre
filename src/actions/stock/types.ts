// Tipos exportados do módulo stock — separados de load.ts para obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.
import type { StockMovement } from "@/db/schema";

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

export interface StockKpis {
  /** Soma de product.stockQuantity (cache) — saldo atual estimado. */
  currentTotal: number;
  /** Soma de deltas positivos no mês corrente (manual_in + sale return + initial). */
  monthIn: number;
  /** Soma de deltas negativos no mês corrente (valor absoluto: manual_out + sale). */
  monthOut: number;
  /** Contagem de movimentos type=adjustment no mês corrente. */
  monthAdjustments: number;
}

export type { StockMovement };
