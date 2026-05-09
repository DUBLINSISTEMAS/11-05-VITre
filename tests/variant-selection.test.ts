import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAddToCartSnapshot,
  isVariantSoldOut,
  resolveVariantPriceState,
  resolveVariantStockState,
} from "../src/lib/cart/variant-selection";

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

const NOW = new Date("2026-05-09T12:00:00Z");

interface ProductLike {
  id: string;
  slug: string;
  name: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  trackStock: boolean;
  stockQuantity: number | null;
}

interface VariantLike {
  id: string;
  productId: string;
  name: string;
  priceInCents: number | null;
  promoPriceInCents: number | null;
  trackStock: boolean;
  stockQuantity: number | null;
}

function product(overrides: Partial<ProductLike> = {}): ProductLike {
  return {
    id: "prod-1",
    slug: "vestido-floral",
    name: "Vestido Floral",
    basePriceInCents: 19900,
    promoPriceInCents: null,
    promoStartsAt: null,
    promoEndsAt: null,
    trackStock: false,
    stockQuantity: null,
    ...overrides,
  };
}

function variant(overrides: Partial<VariantLike> = {}): VariantLike {
  return {
    id: "var-1",
    productId: "prod-1",
    name: "M",
    priceInCents: null,
    promoPriceInCents: null,
    trackStock: false,
    stockQuantity: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// resolveVariantPriceState
// ---------------------------------------------------------------------

test("resolveVariantPriceState: produto sem variante usa preço do produto", () => {
  const state = resolveVariantPriceState(product({ basePriceInCents: 19900 }), null, NOW);

  assert.equal(state.effectivePriceInCents, 19900);
  assert.equal(state.basePriceInCents, 19900);
  assert.equal(state.isOnPromo, false);
});

test("resolveVariantPriceState: variante priceInCents sobrescreve basePrice do produto", () => {
  const state = resolveVariantPriceState(
    product({ basePriceInCents: 19900 }),
    variant({ priceInCents: 24900 }),
    NOW,
  );

  assert.equal(state.basePriceInCents, 24900);
  assert.equal(state.effectivePriceInCents, 24900);
  assert.equal(state.isOnPromo, false);
});

test("resolveVariantPriceState: variante priceInCents null herda basePrice do produto", () => {
  const state = resolveVariantPriceState(
    product({ basePriceInCents: 19900 }),
    variant({ priceInCents: null }),
    NOW,
  );

  assert.equal(state.basePriceInCents, 19900);
  assert.equal(state.effectivePriceInCents, 19900);
});

test("resolveVariantPriceState: promo da variante vence promo do produto", () => {
  const state = resolveVariantPriceState(
    product({
      basePriceInCents: 19900,
      promoPriceInCents: 14900,
      promoStartsAt: new Date("2026-05-01T00:00:00Z"),
      promoEndsAt: new Date("2026-05-31T23:59:59Z"),
    }),
    variant({ priceInCents: 24900, promoPriceInCents: 19900 }),
    NOW,
  );

  // janela do produto vale; preço base é 24900 (variante), promo 19900.
  assert.equal(state.isOnPromo, true);
  assert.equal(state.basePriceInCents, 24900);
  assert.equal(state.effectivePriceInCents, 19900);
});

test("resolveVariantPriceState: promo expirada NÃO é considerada ativa", () => {
  const state = resolveVariantPriceState(
    product({
      basePriceInCents: 19900,
      promoPriceInCents: 14900,
      promoStartsAt: new Date("2026-04-01T00:00:00Z"),
      promoEndsAt: new Date("2026-04-30T23:59:59Z"),
    }),
    null,
    NOW,
  );

  assert.equal(state.isOnPromo, false);
  assert.equal(state.effectivePriceInCents, 19900);
});

// ---------------------------------------------------------------------
// resolveVariantStockState
// ---------------------------------------------------------------------

test("resolveVariantStockState: variante trackStock=true vence produto", () => {
  const stock = resolveVariantStockState(
    product({ trackStock: true, stockQuantity: 99 }),
    variant({ trackStock: true, stockQuantity: 5 }),
  );

  assert.equal(stock.trackStock, true);
  assert.equal(stock.stockQuantity, 5);
});

test("resolveVariantStockState: variante trackStock=false sobrescreve produto pra ilimitado", () => {
  const stock = resolveVariantStockState(
    product({ trackStock: true, stockQuantity: 99 }),
    variant({ trackStock: false, stockQuantity: null }),
  );

  assert.equal(stock.trackStock, false);
  assert.equal(stock.stockQuantity, null);
});

test("resolveVariantStockState: sem variante herda do produto", () => {
  const stock = resolveVariantStockState(
    product({ trackStock: true, stockQuantity: 7 }),
    null,
  );

  assert.equal(stock.trackStock, true);
  assert.equal(stock.stockQuantity, 7);
});

// ---------------------------------------------------------------------
// isVariantSoldOut
// ---------------------------------------------------------------------

test("isVariantSoldOut: variante trackStock=true com stockQty=0 está esgotada", () => {
  const sold = isVariantSoldOut(
    product({ trackStock: false }),
    variant({ trackStock: true, stockQuantity: 0 }),
  );

  assert.equal(sold, true);
});

test("isVariantSoldOut: variante com estoque positivo não está esgotada", () => {
  const sold = isVariantSoldOut(
    product({ trackStock: false }),
    variant({ trackStock: true, stockQuantity: 3 }),
  );

  assert.equal(sold, false);
});

test("isVariantSoldOut: variante trackStock=false (ilimitado) NÃO está esgotada", () => {
  const sold = isVariantSoldOut(
    product({ trackStock: true, stockQuantity: 0 }),
    variant({ trackStock: false, stockQuantity: null }),
  );

  assert.equal(sold, false);
});

// ---------------------------------------------------------------------
// buildAddToCartSnapshot — entrada do addItem
// ---------------------------------------------------------------------

test("buildAddToCartSnapshot: produto sem variante envia variantId=null e variantName=null", () => {
  const snapshot = buildAddToCartSnapshot({
    product: product(),
    variant: null,
    quantity: 2,
    imageUrl: "https://example.com/img.webp",
    now: NOW,
  });

  assert.equal(snapshot.variantId, null);
  assert.equal(snapshot.variantName, null);
  assert.equal(snapshot.productId, "prod-1");
  assert.equal(snapshot.productSlug, "vestido-floral");
  assert.equal(snapshot.productName, "Vestido Floral");
  assert.equal(snapshot.cachedPriceCents, 19900);
  assert.equal(snapshot.cachedStockQty, null);
  assert.equal(snapshot.quantity, 2);
});

test("buildAddToCartSnapshot: variante selecionada usa preço efetivo da variante", () => {
  const snapshot = buildAddToCartSnapshot({
    product: product({
      basePriceInCents: 19900,
      promoPriceInCents: 14900,
      promoStartsAt: new Date("2026-05-01T00:00:00Z"),
      promoEndsAt: new Date("2026-05-31T23:59:59Z"),
    }),
    variant: variant({
      id: "var-G",
      name: "G",
      priceInCents: 24900,
      promoPriceInCents: 19900,
      trackStock: true,
      stockQuantity: 4,
    }),
    quantity: 1,
    imageUrl: null,
    now: NOW,
  });

  assert.equal(snapshot.variantId, "var-G");
  assert.equal(snapshot.variantName, "G");
  assert.equal(snapshot.cachedPriceCents, 19900);
  assert.equal(snapshot.cachedStockQty, 4);
});
