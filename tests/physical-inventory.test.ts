/**
 * Tests do domínio recordPhysicalInventory (Sprint 3C).
 *
 *  1. Source grep — invariantes estruturais (withTenant, rate limit,
 *     advisory lock por entidade, type='adjustment', referência NULL,
 *     skip de delta=0).
 *  2. Cálculo isolado de delta (sanity check pra UX).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadSource(): string {
  return readFileSync("src/actions/stock/record-physical-inventory.ts", "utf8");
}

// ---------------------------------------------------------------------
// Invariantes estruturais
// ---------------------------------------------------------------------

test("recordPhysicalInventory usa withTenant", () => {
  const s = loadSource();
  assert.match(s, /withTenant<RecordPhysicalInventoryResult>\(/);
});

test("recordPhysicalInventory aplica rate limit mutation", () => {
  const s = loadSource();
  assert.match(s, /checkRateLimit\(rateLimits\.mutation/);
});

test("recordPhysicalInventory adquire advisory lock por entidade", () => {
  const s = loadSource();
  // Lock prefixo 'stock-' (mesmo namespace de record-movement.ts e PDV).
  assert.match(s, /pg_advisory_xact_lock.*"stock-"/s);
});

test("recordPhysicalInventory grava stock_movement type='adjustment'", () => {
  const s = loadSource();
  assert.match(s, /movementType:\s*["']adjustment["']/);
});

test("recordPhysicalInventory deixa referenceType/referenceId NULL (ajuste manual)", () => {
  const s = loadSource();
  // Não deve haver atribuição de referenceType nem referenceId no INSERT
  // do stock_movement (vide pattern record-movement.ts).
  assert.doesNotMatch(s, /referenceType:\s*["']/);
  assert.doesNotMatch(s, /referenceId:\s*[^,}]*\bstore\.id/);
});

test("recordPhysicalInventory pula linhas com delta=0 (sem stock_movement)", () => {
  const s = loadSource();
  assert.match(s, /if\s*\(\s*delta\s*===\s*0\s*\)/);
  assert.match(s, /skippedNoChange\s*\+=\s*1/);
});

test("recordPhysicalInventory rejeita produto/variant que não controla estoque", () => {
  const s = loadSource();
  assert.match(s, /não controla estoque/);
});

test("recordPhysicalInventory rejeita variante de outro produto", () => {
  const s = loadSource();
  assert.match(s, /não pertence ao produto/);
});

test("recordPhysicalInventory revalida paths críticos", () => {
  const s = loadSource();
  assert.match(s, /revalidatePath\(["']\/admin\/estoque["']\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/estoque\/contagem["']\)/);
  assert.match(s, /revalidateTag\(`store-/);
});

// ---------------------------------------------------------------------
// Delta math
// ---------------------------------------------------------------------

function delta(systemBefore: number, counted: number): number {
  return counted - systemBefore;
}

test("delta: contado > sistema = +N (entrada por achado)", () => {
  assert.equal(delta(10, 12), 2);
});

test("delta: contado < sistema = -N (saída por perda)", () => {
  assert.equal(delta(10, 7), -3);
});

test("delta: contado == sistema = 0 (skip)", () => {
  assert.equal(delta(10, 10), 0);
});

test("delta: zerar estoque que estava com saldo", () => {
  assert.equal(delta(5, 0), -5);
});

test("delta: encontrar peça onde sistema marcava zero", () => {
  assert.equal(delta(0, 3), 3);
});
