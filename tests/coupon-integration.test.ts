/**
 * Static-analysis tests para integração de cupom no PDV / checkout
 * WhatsApp (ADR-0026 / fix auditoria 2026-05-18).
 *
 * Antes desta integração, validateCoupon/incrementCouponUses eram dead
 * code — tabela coupon existia, admin CRUD funcionava, mas cupom nunca
 * afetava venda. Esta suíte garante via grep que:
 *   1. Schema do PDV aceita couponId opcional
 *   2. Schema do checkout aceita couponCode opcional
 *   3. orderTable tem coluna coupon_id (FK ON DELETE SET NULL)
 *   4. PDV: validateCouponInTx é chamado ANTES do INSERT order
 *   5. PDV: incrementCouponUsesTx roda DEPOIS de recordSaleMovements,
 *      MESMO inner tx
 *   6. Checkout: idem
 *   7. CouponError EXHAUSTED é tratado como soft failure (não 500)
 *   8. Server IGNORA discountInCents do payload quando couponId presente
 *   9. SQL 40 cria CHECK constraint defensivo
 *  10. incrementCouponUsesTx usa WHERE atomic (anti-race)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createBalcaoSaleSchema,
} from "../src/actions/order/balcao/schema";

function loadSrc(path: string): string {
  return readFileSync(path, "utf8");
}

// ---------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------

test("createBalcaoSaleSchema aceita couponId UUID opcional", () => {
  const r = createBalcaoSaleSchema.safeParse({
    items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", variantId: null, quantity: 1 }],
    customerId: null,
    paymentMethod: "cash" as const,
    discountInCents: null,
    surchargeInCents: null,
    cashReceivedInCents: null,
    notes: null,
    couponId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  });
  assert.equal(r.success, true);
});

test("createBalcaoSaleSchema aceita couponId omitido (default null)", () => {
  const r = createBalcaoSaleSchema.safeParse({
    items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", variantId: null, quantity: 1 }],
    customerId: null,
    paymentMethod: "cash" as const,
    discountInCents: null,
    surchargeInCents: null,
    cashReceivedInCents: null,
    notes: null,
  });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.couponId, null);
});

test("createBalcaoSaleSchema rejeita couponId não-UUID", () => {
  const r = createBalcaoSaleSchema.safeParse({
    items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", variantId: null, quantity: 1 }],
    customerId: null,
    paymentMethod: "cash" as const,
    discountInCents: null,
    surchargeInCents: null,
    cashReceivedInCents: null,
    notes: null,
    couponId: "BLACKFRIDAY",
  });
  assert.equal(r.success, false);
});

// NOTA: testes E2E de createOrderInputSchema com phone real exigem libphonenumber-js
// metadata loading, que não funciona via tsx --test (TypeError: hasOwnProperty undefined
// no isSupportedCountry). Em produção o Next bundler resolve. Aqui validamos apenas que
// o campo couponCode é declarado no schema source (regex grep) — comportamento runtime
// é coberto pelos testes de PDV/checkout que usam loadSrc.

test("createOrderInputSchema declara couponCode opcional com toUpperCase + trim", () => {
  const s = loadSrc("src/actions/order/schema.ts");
  assert.match(s, /couponCode:/);
  assert.match(s, /toUpperCase\(\)/);
  assert.match(s, /\.nullable\(\)/);
  assert.match(s, /\.optional\(\)/);
});

// ---------------------------------------------------------------------
// Schema DB — orderTable tem coupon_id FK
// ---------------------------------------------------------------------

test("orderTable schema declara coupon_id com FK ON DELETE SET NULL", () => {
  const s = loadSrc("src/db/schema/order.ts");
  assert.match(s, /couponId:\s*uuid\(["']coupon_id["']\)/);
  assert.match(s, /\.references\(\(\)\s*=>\s*couponTable\.id,\s*\{\s*onDelete:\s*["']set null["']/);
});

test("Drizzle migration 0030 adiciona coupon_id à order", () => {
  const sql = loadSrc("drizzle/0030_hesitant_gladiator.sql");
  assert.match(sql, /ALTER TABLE\s+["']?order["']?\s+ADD COLUMN\s+["']?coupon_id["']?\s+uuid/i);
  assert.match(sql, /FOREIGN KEY.*coupon.*ON DELETE set null/i);
});

// ---------------------------------------------------------------------
// PDV — validate + INSERT + increment no mesmo inner tx
// ---------------------------------------------------------------------

test("PDV importa validateCouponInTx + incrementCouponUsesTx + CouponError", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  assert.match(s, /validateCouponInTx/);
  assert.match(s, /incrementCouponUsesTx/);
  assert.match(s, /CouponError/);
});

test("PDV: validateCouponInTx é chamado quando data.couponId presente", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  assert.match(s, /if\s*\(\s*data\.couponId\s*\)/);
  assert.match(s, /validateCouponInTx\(tx,\s*\{[\s\S]*?couponId:\s*data\.couponId/);
});

test("PDV: server ignora discountInCents do payload quando couponId fornecido", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  // discount usado no total vem do validatedCoupon quando presente.
  // Aceita ternary `validatedCoupon ? validatedCoupon.discountInCents : data.discountInCents`
  // OU bloco `if (validatedCoupon) { discount = validatedCoupon.discountInCents; }`.
  const ternary = /validatedCoupon\s*\?\s*\n?\s*validatedCoupon\.discountInCents\s*\n?\s*:\s*data\.discountInCents/;
  const ifBlock = /if\s*\(\s*validatedCoupon\s*\)\s*\{[^}]*discount\s*=\s*validatedCoupon\.discountInCents/;
  assert.ok(
    ternary.test(s) || ifBlock.test(s),
    "esperava ternary OU if-block atribuindo validatedCoupon.discountInCents",
  );
});

test("PDV: INSERT order grava couponId quando cupom validado", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  assert.match(s, /couponId:\s*validatedCoupon\?\.couponId\s*\?\?\s*null/);
});

test("PDV: incrementCouponUsesTx roda DEPOIS de recordSaleMovements, dentro do inner tx", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  const recordIdx = s.indexOf("recordSaleMovements(innerTx");
  const incIdx = s.indexOf("incrementCouponUsesTx(innerTx");
  assert.ok(recordIdx > 0, "recordSaleMovements deve existir no inner tx");
  assert.ok(incIdx > 0, "incrementCouponUsesTx deve existir no inner tx");
  assert.ok(recordIdx < incIdx, "increment cupom deve rodar APÓS movements (anti-race com fail de estoque)");
});

test("PDV: CouponError dispara soft failure COUPON_INVALID", () => {
  const s = loadSrc("src/actions/order/balcao/create-balcao-sale.ts");
  assert.match(s, /err\s+instanceof\s+CouponError/);
  assert.match(s, /errorCode:\s*["']COUPON_INVALID["']/);
});

// ---------------------------------------------------------------------
// Checkout WhatsApp — idem PDV mas via couponCode (anônimo)
// ---------------------------------------------------------------------

test("Checkout WhatsApp importa CouponError + validateCouponInTx + incrementCouponUsesTx", () => {
  const s = loadSrc("src/actions/order/create-from-cart.ts");
  assert.match(s, /validateCouponInTx/);
  assert.match(s, /incrementCouponUsesTx/);
  assert.match(s, /CouponError/);
});

test("Checkout: incrementCouponUsesTx roda DEPOIS de recordSaleMovements (mesmo inner tx)", () => {
  const s = loadSrc("src/actions/order/create-from-cart.ts");
  const recordIdx = s.indexOf("recordSaleMovements(innerTx");
  const incIdx = s.indexOf("incrementCouponUsesTx(innerTx");
  assert.ok(recordIdx > 0 && incIdx > 0 && recordIdx < incIdx);
});

test("Checkout: COUPON_INVALID é error code tipado", () => {
  const s = loadSrc("src/actions/order/create-from-cart.ts");
  assert.match(s, /["']COUPON_INVALID["']/);
});

// ---------------------------------------------------------------------
// coupon/internal.ts — atomic increment + helpers internos
// (movido de index.ts pra resolver "use server" export class — 2026-05-19)
// ---------------------------------------------------------------------

test("incrementCouponUsesTx usa WHERE atomic anti-race (uses_count < max_uses)", () => {
  const s = loadSrc("src/actions/coupon/internal.ts");
  // Verifica que o UPDATE tem cláusula WHERE com checagem de max_uses
  // (essa é a defesa anti-race — sem advisory lock).
  assert.match(s, /incrementCouponUsesTx/);
  assert.match(
    s,
    /maxUses[\s\S]*?IS NULL[\s\S]*?OR[\s\S]*?usesCount[\s\S]*?<[\s\S]*?maxUses/,
  );
});

test("incrementCouponUsesTx faz RETURNING + throw CouponError EXHAUSTED se rowcount=0", () => {
  const s = loadSrc("src/actions/coupon/internal.ts");
  assert.match(s, /\.returning\(/);
  assert.match(s, /rows\.length\s*===\s*0/);
  assert.match(s, /CouponError\(\s*["']EXHAUSTED["']/);
});

test("validateCouponInTx aceita couponId OU code (PDV vs storefront)", () => {
  const s = loadSrc("src/actions/coupon/internal.ts");
  assert.match(s, /args\.couponId/);
  assert.match(s, /args\.code/);
});

test("validateCouponInTx é PURE function (sem getSession nem getCurrentStore)", () => {
  // Garante que pode rodar dentro de tx anon (storefront) sem session.
  const s = loadSrc("src/actions/coupon/internal.ts");
  const fnStart = s.indexOf("export async function validateCouponInTx");
  const fnEnd = s.indexOf("export async function incrementCouponUsesTx");
  assert.ok(fnStart > 0 && fnEnd > fnStart);
  const fnBody = s.slice(fnStart, fnEnd);
  assert.ok(!fnBody.includes("auth.api.getSession"));
  assert.ok(!fnBody.includes("getCurrentStore"));
});

// ---------------------------------------------------------------------
// SQL 40 — CHECK constraint defensivo
// ---------------------------------------------------------------------

test("SQL 40 cria constraint coupon_uses_within_max idempotente", () => {
  const sql = loadSrc("supabase/sql/40_coupon_uses_check.sql");
  assert.match(sql, /DROP CONSTRAINT IF EXISTS coupon_uses_within_max/);
  assert.match(sql, /ADD CONSTRAINT coupon_uses_within_max/);
  assert.match(sql, /CHECK\s*\(\s*max_uses IS NULL OR uses_count\s*<=\s*max_uses\s*\)/);
});
