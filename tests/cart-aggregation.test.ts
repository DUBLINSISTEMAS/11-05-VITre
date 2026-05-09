import assert from "node:assert/strict";
import test from "node:test";

import { addItemToItems, sameCartLine } from "../src/lib/cart/reducer";
import type { CartItem } from "../src/lib/cart/types";

function makeInput(overrides: Partial<Parameters<typeof addItemToItems>[1]> = {}) {
  return {
    productId: "prod-1",
    variantId: null,
    productSlug: "vestido",
    productName: "Vestido",
    variantName: null,
    imageUrl: null,
    cachedPriceCents: 19900,
    cachedStockQty: null,
    quantity: 1,
    ...overrides,
  };
}

test("sameCartLine: mesma combinação productId+variantId é a mesma linha", () => {
  assert.equal(
    sameCartLine(
      { productId: "p1", variantId: "v1" },
      { productId: "p1", variantId: "v1" },
    ),
    true,
  );
});

test("sameCartLine: variantes diferentes do mesmo produto são linhas distintas", () => {
  assert.equal(
    sameCartLine(
      { productId: "p1", variantId: "v1" },
      { productId: "p1", variantId: "v2" },
    ),
    false,
  );
});

test("sameCartLine: variantId null vs uuid são linhas distintas", () => {
  assert.equal(
    sameCartLine(
      { productId: "p1", variantId: null },
      { productId: "p1", variantId: "v1" },
    ),
    false,
  );
});

test("addItemToItems: adicionar item novo cria nova linha", () => {
  const items: CartItem[] = [];
  const next = addItemToItems(items, makeInput({ quantity: 2 }));

  assert.equal(next.length, 1);
  assert.equal(next[0].quantity, 2);
  assert.equal(next[0].productId, "prod-1");
  assert.equal(next[0].variantId, null);
});

test("addItemToItems: re-adicionar mesma linha agrega quantidade (não duplica)", () => {
  const initial = addItemToItems([], makeInput({ quantity: 1 }));
  const next = addItemToItems(initial, makeInput({ quantity: 3 }));

  assert.equal(next.length, 1);
  assert.equal(next[0].quantity, 4);
});

test("addItemToItems: 2 variantes diferentes do mesmo produto = 2 linhas", () => {
  let items: CartItem[] = [];
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-M", variantName: "M", quantity: 1 }),
  );
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-G", variantName: "G", quantity: 1 }),
  );

  assert.equal(items.length, 2);
  const m = items.find((i) => i.variantId === "var-M");
  const g = items.find((i) => i.variantId === "var-G");
  assert.ok(m && g);
  assert.equal(m!.variantName, "M");
  assert.equal(g!.variantName, "G");
  assert.equal(m!.quantity, 1);
  assert.equal(g!.quantity, 1);
});

test("addItemToItems: produto sem variante (null) e mesmo produto com variante = 2 linhas", () => {
  let items: CartItem[] = [];
  items = addItemToItems(items, makeInput({ variantId: null, quantity: 1 }));
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-1", variantName: "P", quantity: 1 }),
  );

  assert.equal(items.length, 2);
});

test("addItemToItems: re-adicionar mesma variante agrega na linha correta", () => {
  let items: CartItem[] = [];
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-M", variantName: "M", quantity: 1 }),
  );
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-G", variantName: "G", quantity: 1 }),
  );
  items = addItemToItems(
    items,
    makeInput({ variantId: "var-M", variantName: "M", quantity: 2 }),
  );

  assert.equal(items.length, 2);
  const m = items.find((i) => i.variantId === "var-M");
  const g = items.find((i) => i.variantId === "var-G");
  assert.equal(m!.quantity, 3);
  assert.equal(g!.quantity, 1);
});

test("addItemToItems: persiste variantName no item ao criar linha", () => {
  const next = addItemToItems(
    [],
    makeInput({ variantId: "var-M", variantName: "M" }),
  );

  assert.equal(next[0].variantName, "M");
});
