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

/** Sprint 3C — linha da grid de contagem física (`/admin/estoque/contagem`). */
export interface CountableInventoryRow {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  categoryName: string | null;
  unit: string;
  stockQuantity: number;
  minStockQuantity: number | null;
  internalCode: string | null;
  gtin: string | null;
}

/**
 * Onda 1.4 (2026-05-24) — snapshot de saldo por produto pra aba primária
 * em /admin/estoque. Read-only. Diferente de `CountableInventoryRow` (que é
 * uma linha por entidade rastreada incluindo variantes), aqui cada produto
 * vira UMA linha — variantes ficam num `variantBreakdown` resumido. O
 * lojista quer ver a foto-do-dia da loja, não 480 linhas de variação.
 */
export interface StockSnapshotRow {
  productId: string;
  productName: string;
  productSlug: string;
  cover: string | null;
  categoryName: string | null;
  trackStock: boolean;
  /**
   * Saldo do produto-base ou soma das variantes rastreadas. Null quando
   * `trackStock=false` (sem controle) — UI mostra badge "Sem controle".
   */
  stockQuantity: number | null;
  minStockQuantity: number | null;
  unit: string;
  variantCount: number;
  /** Mostrado em accordion no row quando expandido. Vazio quando sem variantes. */
  variantBreakdown: Array<{
    id: string;
    name: string;
    stockQuantity: number | null;
    trackStock: boolean;
  }>;
  basePriceInCents: number;
  costPriceInCents: number | null;
  isActive: boolean;
}

export type StockSnapshotStatus =
  | "all"
  | "with-stock"
  | "zero"
  | "low"
  | "no-tracking";

/**
 * Chave de ordenação clicável nos cabeçalhos da snapshot.
 * Sprint flash 2026-05-24 — Bloco 4 da master list de correção:
 * antes era hardcoded `productName ASC` em load.ts. Lojista vinha pra
 * tela de estoque querendo "produtos com menor saldo primeiro" e tinha
 * que ir pro Excel — bug típico de tabela de gestão sem sort.
 */
export type StockSnapshotSort =
  | "name-asc"
  | "name-desc"
  | "stock-asc"
  | "stock-desc"
  | "min-asc"
  | "min-desc";

export interface LoadStockSnapshotParams {
  q?: string;
  status?: StockSnapshotStatus;
  /** Filtra produtos por categoria. Null/omitido = todas. Sprint flash 2026-05-24. */
  categoryId?: string | null;
  /** Ordenação. Default `name-asc`. Sprint flash 2026-05-24. */
  sort?: StockSnapshotSort;
  page?: number;
  pageSize?: number;
}

export interface LoadStockSnapshotResult {
  items: StockSnapshotRow[];
  total: number;
}
