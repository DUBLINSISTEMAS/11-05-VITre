/**
 * Resolução de estoque considerando produto + variante selecionada.
 *
 * REGRA (ADR-0010 §3 #4):
 *   - Variante com `trackStock=true` VENCE o produto: usa stockQuantity
 *     da variante.
 *   - Variante com `trackStock=false` DESLIGA o controle de estoque,
 *     mesmo que o produto rastreie. Variante "sempre disponível"
 *     sobrescreve o pai.
 *   - Sem variante (produto sem variantes ou caller passa null):
 *     herda do produto.
 *
 * Esta lógica vive aqui pra que client (PDP, drawer) e server
 * (`createOrderFromCart`) usem a mesma fonte da verdade. Sem isso, UI
 * mostra "esgotado" pra produto que server aceitaria, ou vice-versa.
 */

export interface StockSource {
  trackStock: boolean;
  stockQuantity: number | null;
}

export interface ResolvedStock {
  trackStock: boolean;
  stockQuantity: number | null;
}

export function resolveStockState(
  product: StockSource,
  variant: StockSource | null,
): ResolvedStock {
  if (variant && variant.trackStock) {
    return {
      trackStock: true,
      stockQuantity: variant.stockQuantity,
    };
  }
  if (variant && !variant.trackStock) {
    // Variante explicitamente sem controle = sempre disponível,
    // sobrescreve o produto pai.
    return { trackStock: false, stockQuantity: null };
  }
  return {
    trackStock: product.trackStock,
    stockQuantity: product.stockQuantity,
  };
}

export function isStockExhausted(state: ResolvedStock, requested: number = 1): boolean {
  if (!state.trackStock) return false;
  if (state.stockQuantity === null) return true;
  return state.stockQuantity < requested;
}
