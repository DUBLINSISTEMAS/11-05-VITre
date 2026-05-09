/**
 * Reducer puro do carrinho — fonte da verdade para identidade de linha
 * e agregação de quantidade. Usado pelo hook `useCart`; isolado pra
 * permitir testes sem React.
 *
 * REGRA de identidade: uma linha do carrinho é unicamente identificada
 * por (productId, variantId). variantId=null é um valor distinto de
 * qualquer uuid — ou seja, "produto sem variante" e "produto com
 * variante X" coexistem como linhas separadas.
 */
import type { CartItem } from "./types";

export interface CartLineKey {
  productId: string;
  variantId: string | null;
}

export interface AddItemPayload {
  productId: string;
  variantId: string | null;
  productSlug: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  cachedPriceCents: number;
  cachedStockQty: number | null;
  quantity: number;
}

export function sameCartLine(a: CartLineKey, b: CartLineKey): boolean {
  return a.productId === b.productId && a.variantId === b.variantId;
}

/**
 * Devolve um novo array de items com `payload` aplicado: agrega quantity
 * se a linha (productId, variantId) já existe; senão, anexa nova linha.
 */
export function addItemToItems(
  items: CartItem[],
  payload: AddItemPayload,
  now: Date = new Date(),
): CartItem[] {
  const idx = items.findIndex((it) => sameCartLine(it, payload));

  if (idx >= 0) {
    const next = [...items];
    const existing = next[idx];
    next[idx] = {
      ...existing,
      quantity: existing.quantity + payload.quantity,
    };
    return next;
  }

  const newItem: CartItem = {
    productId: payload.productId,
    variantId: payload.variantId,
    productSlug: payload.productSlug,
    productName: payload.productName,
    variantName: payload.variantName,
    imageUrl: payload.imageUrl,
    cachedPriceCents: payload.cachedPriceCents,
    cachedStockQty: payload.cachedStockQty,
    quantity: payload.quantity,
    addedAt: now.toISOString(),
  };

  return [...items, newItem];
}
