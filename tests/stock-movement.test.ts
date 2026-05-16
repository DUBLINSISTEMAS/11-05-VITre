import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MANUAL_MOVEMENT_TYPES,
  recordMovementSchema,
} from "../src/actions/stock/schema";

// ---------------------------------------------------------------------
// Zod schema — recordMovementSchema (Fase 4 / ADR-0015)
// ---------------------------------------------------------------------

test("stock: aceita payload mínimo manual_in (productId + quantity)", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 5,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.movementType, "manual_in");
  assert.equal(result.data.quantity, 5);
  assert.equal(result.data.variantId, null);
  assert.equal(result.data.notes, null);
});

test("stock: aceita manual_out", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_out",
    quantity: 3,
  });
  assert.equal(result.success, true);
});

test("stock: rejeita quantity 0", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 0,
  });
  assert.equal(result.success, false);
});

test("stock: rejeita quantity negativa (sinal vem do tipo)", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: -3,
  });
  assert.equal(result.success, false);
});

test("stock: rejeita productId não-UUID", () => {
  const result = recordMovementSchema.safeParse({
    productId: "not-a-uuid",
    movementType: "manual_in",
    quantity: 5,
  });
  assert.equal(result.success, false);
});

test("stock: variantId opcional aceita null/undefined", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 5,
    variantId: null,
  });
  assert.equal(result.success, true);
});

test("stock: variantId presente exige UUID válido", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 5,
    variantId: "not-a-uuid",
  });
  assert.equal(result.success, false);
});

test("stock: adjustment SEM direction é rejeitado", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "adjustment",
    quantity: 5,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const issue = result.error.issues.find(
    (i) => i.path[0] === "adjustmentDirection",
  );
  assert.ok(issue, "esperava issue em adjustmentDirection");
});

test("stock: adjustment positivo passa", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "adjustment",
    quantity: 5,
    adjustmentDirection: "positive",
  });
  assert.equal(result.success, true);
});

test("stock: adjustment negative passa", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "adjustment",
    quantity: 5,
    adjustmentDirection: "negative",
  });
  assert.equal(result.success, true);
});

test("stock: notes vazia vira null", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 5,
    notes: "",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.notes, null);
});

test("stock: notes > 500 chars é rejeitada", () => {
  const result = recordMovementSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    movementType: "manual_in",
    quantity: 5,
    notes: "x".repeat(501),
  });
  assert.equal(result.success, false);
});

test("stock: tipos não-manuais (sale/return/initial) são rejeitados na action manual", () => {
  for (const type of ["sale", "return", "initial"]) {
    const result = recordMovementSchema.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      movementType: type,
      quantity: 5,
    });
    assert.equal(result.success, false, `tipo ${type} deveria ser rejeitado`);
  }
});

test("stock: MANUAL_MOVEMENT_TYPES exporta exatamente os 3 manuais", () => {
  assert.deepEqual(Array.from(MANUAL_MOVEMENT_TYPES), [
    "manual_in",
    "manual_out",
    "adjustment",
  ]);
});

// ---------------------------------------------------------------------
// Static-analysis: create-from-cart usa INSERT stock_movement (Fase 4)
// ---------------------------------------------------------------------

function loadCreateFromCartSource(): string {
  return readFileSync("src/actions/order/create-from-cart.ts", "utf8");
}

test("create-from-cart: registra venda via helper recordSaleMovements (Fase 5)", () => {
  const src = loadCreateFromCartSource();
  // Fase 5 (ADR-0016): INSERT batch foi extraído pra helper compartilhado
  // com PDV (`src/lib/order/record-sale-movements.ts`).
  assert.match(src, /recordSaleMovements\(/);
  assert.match(src, /@\/lib\/order\/record-sale-movements/);
});

test("record-sale-movements helper: INSERT type='sale' com delta negativo + reference_type='order'", () => {
  const src = readFileSync(
    "src/lib/order/record-sale-movements.ts",
    "utf8",
  );
  assert.match(src, /tx\.insert\(stockMovementTable\)/);
  assert.match(src, /movementType:\s*["']sale["']/);
  assert.match(src, /referenceType:\s*["']order["']/);
  // delta negativo (saída de estoque)
  assert.match(src, /quantityDelta:\s*-s\.quantity/);
});

test("create-from-cart: usa advisory lock por entidade alvo", () => {
  const src = loadCreateFromCartSource();
  // pg_advisory_xact_lock serializa checkouts concorrentes do mesmo
  // produto/variant — previne oversell quando o pre-check é separado
  // do INSERT do movement.
  assert.match(src, /pg_advisory_xact_lock/);
  assert.match(src, /hashtext/);
});

test("create-from-cart: NÃO usa mais UPDATE direto em product/variant pra estoque", () => {
  const src = loadCreateFromCartSource();
  // Pre-Fase 4 o decremento era `innerTx.update(productTable).set({ stockQuantity: ... })`.
  // Agora é responsabilidade do trigger SQL.
  assert.doesNotMatch(
    src,
    /innerTx\.update\(productVariantTable\)\s*\.set\(\s*\{\s*stockQuantity:/,
  );
  assert.doesNotMatch(
    src,
    /innerTx\.update\(productTable\)\s*\.set\(\s*\{\s*stockQuantity:/,
  );
});
