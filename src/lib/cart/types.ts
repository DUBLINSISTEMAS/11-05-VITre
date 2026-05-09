/**
 * Tipos do carrinho client-side. Sem dependência server.
 * Schema versionado pra que mudanças quebradas não corrompam dados antigos.
 */

export const CART_SCHEMA_VERSION = 1;
export const CART_TTL_DAYS = 7;

export interface CartItem {
  /** ID do produto (UUID). */
  productId: string;
  /** ID da variante (UUID) — null se produto sem variantes. */
  variantId: string | null;
  /** Snapshot pra UI client-side. Server SEMPRE recalcula no checkout. */
  productSlug: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  /** Preço cacheado pra exibir; server recalcula com pricing.ts. */
  cachedPriceCents: number;
  /** trackStock + stockQuantity capturados pra UI; server valida fresh. */
  cachedStockQty: number | null;
  quantity: number;
  /** Timestamp ISO de quando o item foi adicionado (debug + analytics). */
  addedAt: string;
}

export interface CartState {
  version: number;
  items: CartItem[];
  /** Timestamp ISO da última escrita — alimenta o TTL. */
  savedAt: string;
}

export const EMPTY_CART: CartState = {
  version: CART_SCHEMA_VERSION,
  items: [],
  savedAt: new Date(0).toISOString(),
};
