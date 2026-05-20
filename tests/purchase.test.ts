/**
 * Tests do domínio purchase (Sprint 3).
 *
 * Mistura de:
 *  1. Zod schema (execução real do safeParse)
 *  2. Source grep — invariantes estruturais que não dá pra validar sem
 *     rodar contra prod (advisory lock, WAC, INSERT em batch, etc).
 *  3. Cálculo WAC isolado (pra garantir fórmula correta).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPurchaseSchema,
  markPurchasePaidSchema,
  purchaseItemInputSchema,
} from "../src/actions/purchase/schema";

// ---------------------------------------------------------------------
// Schema — purchaseItemInputSchema
// ---------------------------------------------------------------------

test("purchaseItem aceita campos mínimos válidos", () => {
  const r = purchaseItemInputSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: 5,
    unitCostInCents: 1200,
  });
  assert.equal(r.success, true);
});

test("purchaseItem rejeita quantidade zero ou negativa", () => {
  const r0 = purchaseItemInputSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: 0,
    unitCostInCents: 1200,
  });
  assert.equal(r0.success, false);
  const rNeg = purchaseItemInputSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: -1,
    unitCostInCents: 1200,
  });
  assert.equal(rNeg.success, false);
});

test("purchaseItem aceita custo zero (item promocional/brinde)", () => {
  const r = purchaseItemInputSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: 1,
    unitCostInCents: 0,
  });
  assert.equal(r.success, true);
});

test("purchaseItem rejeita custo negativo", () => {
  const r = purchaseItemInputSchema.safeParse({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: 1,
    unitCostInCents: -100,
  });
  assert.equal(r.success, false);
});

// ---------------------------------------------------------------------
// Schema — createPurchaseSchema
// ---------------------------------------------------------------------

function validPurchase() {
  return {
    supplierId: null,
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 5,
        unitCostInCents: 1200,
      },
    ],
  };
}

test("createPurchase aceita compra mínima (1 item, sem fornecedor)", () => {
  const r = createPurchaseSchema.safeParse(validPurchase());
  assert.equal(r.success, true);
});

test("createPurchase rejeita items vazio", () => {
  const r = createPurchaseSchema.safeParse({ ...validPurchase(), items: [] });
  assert.equal(r.success, false);
});

test("createPurchase aceita 200 items, rejeita 201", () => {
  const items = Array.from({ length: 200 }, () => ({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    quantity: 1,
    unitCostInCents: 100,
  }));
  const r200 = createPurchaseSchema.safeParse({
    ...validPurchase(),
    items,
  });
  assert.equal(r200.success, true);
  const r201 = createPurchaseSchema.safeParse({
    ...validPurchase(),
    items: [...items, items[0]!],
  });
  assert.equal(r201.success, false);
});

test("createPurchase aceita supplierId UUID válido", () => {
  const r = createPurchaseSchema.safeParse({
    ...validPurchase(),
    supplierId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  });
  assert.equal(r.success, true);
});

test("createPurchase aceita invoiceNumber até 60 chars, rejeita 61", () => {
  const r60 = createPurchaseSchema.safeParse({
    ...validPurchase(),
    invoiceNumber: "x".repeat(60),
  });
  assert.equal(r60.success, true);
  const r61 = createPurchaseSchema.safeParse({
    ...validPurchase(),
    invoiceNumber: "x".repeat(61),
  });
  assert.equal(r61.success, false);
});

test("createPurchase paidNow default false; paymentMethod default null", () => {
  const r = createPurchaseSchema.safeParse(validPurchase());
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.paidNow, false);
    assert.equal(r.data.paymentMethod, null);
  }
});

test("createPurchase notes vazio vira null", () => {
  const r = createPurchaseSchema.safeParse({ ...validPurchase(), notes: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.notes, null);
});

test("createPurchase invoiceNumber vazio vira null", () => {
  const r = createPurchaseSchema.safeParse({
    ...validPurchase(),
    invoiceNumber: "",
  });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.invoiceNumber, null);
});

// ---------------------------------------------------------------------
// markPurchasePaidSchema
// ---------------------------------------------------------------------

test("markPurchasePaid exige paymentMethod válido", () => {
  const r = markPurchasePaidSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    paymentMethod: "cash",
  });
  assert.equal(r.success, true);
  const rBad = markPurchasePaidSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    paymentMethod: "boleto",
  });
  assert.equal(rBad.success, false);
});

// ---------------------------------------------------------------------
// Source — invariantes estruturais
// ---------------------------------------------------------------------

function loadActionSource(): string {
  return readFileSync("src/actions/purchase/index.ts", "utf8");
}

test("createPurchase usa withTenant", () => {
  const s = loadActionSource();
  assert.match(s, /withTenant<CreatePurchaseResult>\(/);
});

test("createPurchase aplica rate limit mutation", () => {
  const s = loadActionSource();
  assert.match(s, /checkRateLimit\(rateLimits\.mutation,/);
});

test("createPurchase adquire advisory lock POR PRODUTO antes de WAC", () => {
  const s = loadActionSource();
  assert.match(s, /pg_advisory_xact_lock.*cost-product-/);
});

test("createPurchase calcula WAC com fórmula correta", () => {
  const s = loadActionSource();
  // Precisamos achar a expressão (aggregateStock * currentCost + newQty * newCost) / totalQty
  assert.match(s, /aggregateStock\s*\*\s*currentCost\s*\+\s*newQty\s*\*\s*newCost/);
  assert.match(s, /\/\s*totalQty/);
});

test("createPurchase atualiza product.cost_price_in_cents", () => {
  const s = loadActionSource();
  assert.match(s, /costPriceInCents:\s*weightedCost/);
});

test("createPurchase INSERT stock_movement type='manual_in' reference='purchase'", () => {
  const s = loadActionSource();
  assert.match(s, /movementType:\s*["']manual_in["']/);
  assert.match(s, /referenceType:\s*["']purchase["']/);
});

test("createPurchase gera cash_adjustment type='pay_supplier' quando paidNow", () => {
  const s = loadActionSource();
  assert.match(s, /type:\s*["']pay_supplier["']/);
});

test("createPurchase grava productNameSnapshot em purchase_item", () => {
  const s = loadActionSource();
  assert.match(s, /productNameSnapshot:\s*p\.name/);
});

test("createPurchase NÃO permite editar compra (apenas markPurchasePaid)", () => {
  const s = loadActionSource();
  // Não deve haver função updatePurchase exportada.
  assert.doesNotMatch(s, /export async function updatePurchase\b/);
});

// ---------------------------------------------------------------------
// WAC isolated math — replicação Pure-TS da fórmula do action.
// ---------------------------------------------------------------------

function wac(
  currentStock: number,
  currentCost: number,
  newQty: number,
  newCost: number,
): number {
  if (currentCost === 0 || currentStock === 0) return newCost;
  const totalQty = currentStock + newQty;
  return Math.round(
    (currentStock * currentCost + newQty * newCost) / totalQty,
  );
}

test("WAC: primeira compra (stock=0) usa custo da nova compra", () => {
  // stock 0, cost null/0 → novo custo = 1500
  assert.equal(wac(0, 0, 10, 1500), 1500);
});

test("WAC: stock atual com custo zero é tratado como primeira entrada", () => {
  // Defensivo: produto novo com custo nunca definido.
  assert.equal(wac(5, 0, 10, 2000), 2000);
});

test("WAC: média ponderada clássica", () => {
  // 10 peças @ 1000 + 10 peças @ 2000 = 20 peças @ 1500 médio
  assert.equal(wac(10, 1000, 10, 2000), 1500);
});

test("WAC: peso correto quando estoques desbalanceados", () => {
  // 50 @ 1000 + 50 @ 2000 = 100 @ 1500
  assert.equal(wac(50, 1000, 50, 2000), 1500);
  // 90 @ 1000 + 10 @ 2000 = 100 @ 1100
  assert.equal(wac(90, 1000, 10, 2000), 1100);
});

test("WAC: arredondamento integer (centavos)", () => {
  // 3 @ 100 + 1 @ 199 = (300 + 199) / 4 = 124.75 → 125
  assert.equal(wac(3, 100, 1, 199), 125);
});
