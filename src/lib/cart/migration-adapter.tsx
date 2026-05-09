"use client";

/**
 * Migration adapter — pivot canvas-v1 → repo real.
 *
 * Os arquivos da pasta `migration v2/` foram escritos contra um shape de
 * canvas (com `customerWhatsApp` / `customerNote` e sem `idempotencyKey`).
 * O repo real (`@/actions/order/create-from-cart`) usa `customerPhone` /
 * `customerNotes` e exige `idempotencyKey`. Em vez de reescrever a chamada
 * em cada componente do canvas, este adapter traduz na borda — JSX intacto,
 * só o import muda durante a cópia.
 *
 * Re-exports (pass-through, shapes idênticos):
 *   - useCart, useFavorites
 *   - formatBRL / formatPrice
 *   - getEffectivePrice, hasActivePromo
 *
 * Adapters:
 *   - createOrderFromCart / createOrderFromCartAction:
 *       aceita shape canvas, gera idempotencyKey, mapeia pra real action,
 *       retorna { shortCode, whatsappUrl } em sucesso ou throw em falha
 *       (compatível com o try/catch do CheckoutPanel).
 */

import { createOrderFromCart as realCreateOrderFromCart } from "@/actions/order/create-from-cart";

export { useCart } from "@/hooks/use-cart";
export { useFavorites } from "@/hooks/use-favorites";
export { getEffectivePrice, hasActivePromo } from "@/lib/pricing";
export { formatBRL, formatBRL as formatPrice } from "@/lib/storefront/i18n";

export interface MigrationCartItemInput {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface MigrationCreateOrderInput {
  storeSlug: string;
  customerName: string;
  customerWhatsApp: string;
  customerNote?: string;
  items: MigrationCartItemInput[];
}

export interface MigrationCreateOrderResult {
  shortCode: string;
  whatsappUrl?: string;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (não deve ser usado em runtime moderno; satisfaz tipo no SSR).
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Adapter: aceita shape canvas, chama real action.
 * - customerWhatsApp → customerPhone
 * - customerNote → customerNotes
 * - injeta idempotencyKey
 * - filtra items para apenas { productId, variantId, quantity }
 */
export async function createOrderFromCart(
  input: MigrationCreateOrderInput,
): Promise<MigrationCreateOrderResult> {
  const result = await realCreateOrderFromCart({
    storeSlug: input.storeSlug,
    customerName: input.customerName,
    customerPhone: input.customerWhatsApp,
    customerNotes: input.customerNote ?? "",
    idempotencyKey: generateIdempotencyKey(),
    items: input.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
    })),
  });

  if (!result.ok || !result.shortCode) {
    throw new Error(result.errorMessage ?? "Erro ao finalizar pedido");
  }

  return {
    shortCode: result.shortCode,
    whatsappUrl: result.whatsappUrl,
  };
}

/**
 * Alias com sufixo `Action` — convenção solicitada no briefing do redesign.
 */
export const createOrderFromCartAction = createOrderFromCart;
