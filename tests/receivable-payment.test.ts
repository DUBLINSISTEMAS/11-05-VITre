/**
 * Tests do domínio receivable_payment (Sprint 4B).
 *
 * Source-level invariants + math isolado da fórmula de quitação.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadActionSource(): string {
  return readFileSync("src/actions/receivable/record-payment.ts", "utf8");
}

function loadMarkPaidSource(): string {
  return readFileSync("src/actions/receivable/mark-paid.ts", "utf8");
}

function loadLoadPendingSource(): string {
  return readFileSync("src/actions/receivable/load-pending.ts", "utf8");
}

// ---------------------------------------------------------------------
// recordReceivablePayment — invariantes
// ---------------------------------------------------------------------

test("recordReceivablePayment usa withTenant", () => {
  const s = loadActionSource();
  assert.match(s, /withTenant<RecordReceivablePaymentResult>\(/);
});

test("recordReceivablePayment aplica rate limit mutation", () => {
  const s = loadActionSource();
  assert.match(s, /checkRateLimit\(rateLimits\.mutation/);
});

test("recordReceivablePayment adquire advisory lock por receivable", () => {
  const s = loadActionSource();
  assert.match(s, /pg_advisory_xact_lock.*receivable-/);
});

test("recordReceivablePayment INSERT em receivable_payment (append-only)", () => {
  const s = loadActionSource();
  // Multi-line `.insert(receivablePaymentTable)` — usar regex que tolera
  // quebra de linha entre `tx` e o método.
  assert.match(s, /\.insert\(receivablePaymentTable\)/);
  // Append-only: sem UPDATE/DELETE em payment.
  assert.doesNotMatch(s, /\.update\(receivablePaymentTable\)/);
  assert.doesNotMatch(s, /\.delete\(receivablePaymentTable\)/);
});

test("recordReceivablePayment seta paid_at quando soma >= amount", () => {
  const s = loadActionSource();
  assert.match(s, /fullyPaid/);
  assert.match(s, /paidAt:\s*new Date\(\)/);
});

test("recordReceivablePayment recusa pagamento maior que saldo", () => {
  const s = loadActionSource();
  assert.match(s, /Valor maior que o saldo restante/);
});

test("recordReceivablePayment recusa pagamento em fiado já quitado", () => {
  const s = loadActionSource();
  assert.match(s, /Este fiado já está quitado/);
});

test("recordReceivablePayment gera cash_adjustment 'other_in' quando há caixa aberto", () => {
  const s = loadActionSource();
  assert.match(s, /type:\s*["']other_in["']/);
  // Valor do adjustment = valor do payment ATUAL (não acumulado)
  assert.match(s, /amountInCents:\s*data\.amountInCents/);
});

test("recordReceivablePayment revalida paths críticos", () => {
  const s = loadActionSource();
  assert.match(s, /revalidatePath\(["']\/admin\/financeiro\/receber["']\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/pdv\/caixa["']\)/);
});

// ---------------------------------------------------------------------
// markReceivablePaid — alias compat
// ---------------------------------------------------------------------

test("markReceivablePaid delega pra recordReceivablePayment", () => {
  const s = loadMarkPaidSource();
  assert.match(s, /recordReceivablePayment\(\{/);
});

test("markReceivablePaid permanece idempotente (já pago = ok)", () => {
  const s = loadMarkPaidSource();
  assert.match(s, /if\s*\(lookup\.paidAt\)/);
});

// ---------------------------------------------------------------------
// loadPendingReceivables — Sprint 4B integra paidInCents/remainingInCents
// ---------------------------------------------------------------------

test("loadPendingReceivables agrega SUM(receivable_payment.amount) por receivable", () => {
  const s = loadLoadPendingSource();
  assert.match(s, /sum\(\$\{receivablePaymentTable\.amountInCents\}\)/);
});

test("loadPendingReceivables exporta remainingInCents", () => {
  const s = loadLoadPendingSource();
  assert.match(s, /remainingInCents:/);
});

// ---------------------------------------------------------------------
// Math isolado: derivação de paid_at + saldo
// ---------------------------------------------------------------------

interface QuitacaoState {
  amountInCents: number;
  payments: number[];
}

function paidSum(s: QuitacaoState): number {
  return s.payments.reduce((acc, p) => acc + p, 0);
}

function isFullyPaid(s: QuitacaoState): boolean {
  return paidSum(s) >= s.amountInCents;
}

function remaining(s: QuitacaoState): number {
  return Math.max(0, s.amountInCents - paidSum(s));
}

test("quitação: nenhum pagamento = saldo = total", () => {
  const s = { amountInCents: 30000, payments: [] };
  assert.equal(remaining(s), 30000);
  assert.equal(isFullyPaid(s), false);
});

test("quitação: pagamento parcial reduz saldo", () => {
  const s = { amountInCents: 30000, payments: [10000] };
  assert.equal(remaining(s), 20000);
  assert.equal(isFullyPaid(s), false);
});

test("quitação: múltiplos parciais somam corretamente", () => {
  const s = { amountInCents: 30000, payments: [10000, 5000, 5000] };
  assert.equal(remaining(s), 10000);
  assert.equal(isFullyPaid(s), false);
});

test("quitação: soma == amount = quitado, saldo 0", () => {
  const s = { amountInCents: 30000, payments: [10000, 20000] };
  assert.equal(remaining(s), 0);
  assert.equal(isFullyPaid(s), true);
});

test("quitação: soma > amount (sobra) ainda conta como quitado, saldo 0", () => {
  const s = { amountInCents: 30000, payments: [40000] };
  // App-layer não deve permitir isso (CHECK no remaining) mas math é robusto.
  assert.equal(remaining(s), 0);
  assert.equal(isFullyPaid(s), true);
});
