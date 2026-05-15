import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hook = readFileSync("src/hooks/use-cart.tsx", "utf8");

test("useCart updateQty caps requested quantity to cached stock", () => {
  const updateQtyBlock = hook.match(/const updateQty[\s\S]*?const clearCart/)?.[0] ?? "";

  assert.match(updateQtyBlock, /capCartQuantity/);
  assert.doesNotMatch(updateQtyBlock, /quantity: qty/);
});
