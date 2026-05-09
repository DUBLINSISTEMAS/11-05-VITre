/**
 * Lógica pura de seleção de variante na PDP.
 *
 * Responsabilidades:
 *   1. Resolver o preço efetivo considerando a variante selecionada
 *      (variant.priceInCents/promoPriceInCents sobrescreve product).
 *   2. Resolver o estado de estoque considerando a variante (delegando
 *      pra `resolveStockState` em `lib/cart/stock.ts` — fonte da verdade).
 *   3. Detectar se a variante está esgotada.
 *   4. Construir o payload do `addItem` com snapshot consistente.
 *
 * Mantém o cliente (PDP) e o servidor (`createOrderFromCart`) alinhados:
 * ambos usam `pricing.ts:getEffectivePrice` e `cart/stock.ts:resolveStockState`.
 */
import type { AddItemPayload } from "@/lib/cart/reducer";
import { type ResolvedStock,resolveStockState } from "@/lib/cart/stock";
import { getEffectivePrice, hasActivePromo } from "@/lib/pricing";

export interface ProductPricingFields {
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
}

export interface ProductStockFields {
  trackStock: boolean;
  stockQuantity: number | null;
}

export interface ProductIdentity {
  id: string;
  slug: string;
  name: string;
}

export interface VariantPricingFields {
  priceInCents: number | null;
  promoPriceInCents: number | null;
}

export interface VariantStockFields {
  trackStock: boolean;
  stockQuantity: number | null;
}

export interface VariantIdentity {
  id: string;
  productId: string;
  name: string;
}

export type ProductForSelection = ProductIdentity &
  ProductPricingFields &
  ProductStockFields;

export type VariantForSelection = VariantIdentity &
  VariantPricingFields &
  VariantStockFields;

export interface VariantPriceState {
  /** Preço base efetivo (variant.priceInCents ?? product.basePriceInCents). */
  basePriceInCents: number;
  /** Preço efetivo a cobrar (promo se ativo, senão base). */
  effectivePriceInCents: number;
  /** True se há promoção ativa AGORA (janela de datas + promoPrice válido). */
  isOnPromo: boolean;
}

/**
 * Preço efetivo considerando variante selecionada.
 *
 * Variante sem `priceInCents` herda `basePriceInCents` do produto.
 * Variante com `priceInCents` sobrescreve. A janela de promoção
 * (`promoStartsAt`/`promoEndsAt`) sempre vem do produto — não há
 * janela por variante no schema atual.
 */
export function resolveVariantPriceState(
  product: ProductPricingFields,
  variant: VariantPricingFields | null,
  now: Date = new Date(),
): VariantPriceState {
  const basePriceInCents =
    variant?.priceInCents ?? product.basePriceInCents;
  const promoPriceInCents =
    variant?.promoPriceInCents ?? product.promoPriceInCents;

  const promoFields = {
    basePriceInCents,
    promoPriceInCents,
    promoStartsAt: product.promoStartsAt,
    promoEndsAt: product.promoEndsAt,
  };

  return {
    basePriceInCents,
    effectivePriceInCents: getEffectivePrice(promoFields, now),
    isOnPromo: hasActivePromo(promoFields, now),
  };
}

/**
 * Re-export tipado do estoque resolvido com variante. Mantém a lógica
 * em `lib/cart/stock.ts` (fonte única) — o helper aqui só dá conveniência
 * de chamada com tipos da PDP.
 */
export function resolveVariantStockState(
  product: ProductStockFields,
  variant: VariantStockFields | null,
): ResolvedStock {
  return resolveStockState(
    { trackStock: product.trackStock, stockQuantity: product.stockQuantity },
    variant
      ? { trackStock: variant.trackStock, stockQuantity: variant.stockQuantity }
      : null,
  );
}

/**
 * Variante esgotada quando trackStock=true E stockQuantity ≤ 0.
 * Variante com trackStock=false nunca está esgotada (ilimitada).
 */
export function isVariantSoldOut(
  product: ProductStockFields,
  variant: VariantStockFields | null,
): boolean {
  const stock = resolveVariantStockState(product, variant);
  if (!stock.trackStock) return false;
  if (stock.stockQuantity === null) return true;
  return stock.stockQuantity <= 0;
}

interface BuildSnapshotInput {
  product: ProductForSelection;
  variant: VariantForSelection | null;
  quantity: number;
  imageUrl: string | null;
  now?: Date;
}

/**
 * Constrói o payload de `addItem` (cart) a partir de produto + variante
 * selecionada + quantidade. Single source of truth pra "como entra no
 * carrinho um produto-com-variante" — testado isoladamente.
 */
export function buildAddToCartSnapshot(
  input: BuildSnapshotInput,
): AddItemPayload {
  const now = input.now ?? new Date();
  const price = resolveVariantPriceState(input.product, input.variant, now);
  const stock = resolveVariantStockState(input.product, input.variant);

  return {
    productId: input.product.id,
    variantId: input.variant?.id ?? null,
    productSlug: input.product.slug,
    productName: input.product.name,
    variantName: input.variant?.name ?? null,
    imageUrl: input.imageUrl,
    cachedPriceCents: price.effectivePriceInCents,
    cachedStockQty: stock.stockQuantity,
    quantity: input.quantity,
  };
}
