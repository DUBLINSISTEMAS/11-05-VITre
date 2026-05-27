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

export function capCartQuantity(
  quantity: number,
  stockQty: number | null,
): number {
  if (stockQty === null) return quantity;
  return Math.min(quantity, stockQty);
}

/**
 * Onda 31 (2026-05-27): retorna o cap "mais conservador" entre dois
 * valores de cachedStockQty. null = ilimitado, então o outro vence.
 * Caso ambos finitos, pega o menor.
 *
 * Por quê: addItemToItems estava sobrescrevendo cachedStockQty existente
 * pelo payload novo. Cenário: cliente adicionou 3 quando stock era 5;
 * lojista reduziu pra 4; cliente adiciona +1 — payload diz stock=4 mas
 * o item já tinha qty=3 com cache antigo de 5. Resultado: cap aceita
 * qty=4 mas server pode falhar com OUT_OF_STOCK se outro cliente já
 * pegou. Usar o menor dos dois evita o cenário comum.
 */
function minStockCap(
  a: number | null,
  b: number | null,
): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
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
    // Onda 31: cap usa o MENOR entre stockQty existing e payload — evita
    // aceitar qty > stock real quando lojista reduziu estoque entre
    // adds. Server tx confirma com lock advisory, mas client conservador
    // reduz chance de OUT_OF_STOCK no submit.
    const cap = minStockCap(existing.cachedStockQty, payload.cachedStockQty);
    next[idx] = {
      ...existing,
      cachedStockQty: cap,
      quantity: capCartQuantity(existing.quantity + payload.quantity, cap),
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
    quantity: capCartQuantity(payload.quantity, payload.cachedStockQty),
    addedAt: now.toISOString(),
  };

  return [...items, newItem];
}
