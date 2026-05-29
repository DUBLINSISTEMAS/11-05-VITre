/**
 * Tests de createStandaloneReceivable (Sprint 4D).
 *
 * Source-level invariants + Zod schema.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadSource(): string {
  return readFileSync("src/actions/receivable/create-standalone.ts", "utf8");
}

test("createStandaloneReceivable usa withTenant", () => {
  const s = loadSource();
  assert.match(s, /withTenant<CreateStandaloneReceivableResult>\(/);
});

test("createStandaloneReceivable aplica rate limit mutation", () => {
  const s = loadSource();
  assert.match(s, /checkRateLimit\(rateLimits\.mutation/);
});

test("createStandaloneReceivable INSERT receivable com orderId=null", () => {
  const s = loadSource();
  // Garante que orderId é explicitamente null (fiado avulso, sem venda)
  assert.match(s, /orderId:\s*null/);
});

test("createStandaloneReceivable valida que customer pertence à loja", () => {
  const s = loadSource();
  assert.match(s, /Cliente não encontrado/);
});

test("createStandaloneReceivable amount > 0 obrigatório (Zod)", () => {
  const s = loadSource();
  assert.match(s, /\.positive\(/);
});

test("createStandaloneReceivable revalida paths do fluxo de fiado", () => {
  const s = loadSource();
  // Onda L2 (2026-05-29) — rota consolidada em /admin/financeiro.
  assert.match(s, /revalidatePath\(["']\/admin\/financeiro["']\)/);
});

test("createStandaloneReceivable aceita dueDate nulo (sem vencimento)", () => {
  const s = loadSource();
  assert.match(s, /dueDate:.*nullable\(\)/s);
});

test("createStandaloneReceivable preserva append-only (sem update/delete)", () => {
  const s = loadSource();
  assert.doesNotMatch(s, /\.update\(receivableTable\)/);
  assert.doesNotMatch(s, /\.delete\(receivableTable\)/);
});
