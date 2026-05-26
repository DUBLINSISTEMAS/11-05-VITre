/**
 * Testes de cálculo multa + juros fiado (S3.2).
 *
 * Pure-function tests — sem DB. Cobrem casos reais BR:
 * fiado em dia, vencido 30 dias, vencido 60 dias, recebimento parcial.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyReceivablePayment,
  calculateReceivableFees,
} from "../src/lib/receivable-fees";

test("calculateReceivableFees: fiado em dia → zero fees", () => {
  const result = calculateReceivableFees({
    principalInCents: 20000, // R$ 200
    dueDate: new Date("2026-06-01"),
    lateFeeBps: 200,
    interestPerMonthBps: 100,
    now: new Date("2026-05-26"),
  });
  assert.equal(result.feeInCents, 0);
  assert.equal(result.interestInCents, 0);
  assert.equal(result.totalInCents, 20000);
  assert.equal(result.daysLate, 0);
});

test("calculateReceivableFees: dueDate null → zero fees", () => {
  const result = calculateReceivableFees({
    principalInCents: 20000,
    dueDate: null,
    lateFeeBps: 200,
    interestPerMonthBps: 100,
  });
  assert.equal(result.totalInCents, 20000);
});

test("calculateReceivableFees: vencido 30 dias com 2% multa + 1%/mês juros", () => {
  // R$ 200 vencido há exatos 30 dias = 1 mês de atraso.
  // Multa: 200 × 2% = R$ 4
  // Juros: 200 × 1% × 1 mês = R$ 2
  // Total: R$ 206
  const result = calculateReceivableFees({
    principalInCents: 20000,
    dueDate: new Date("2026-04-26T00:00:00Z"),
    lateFeeBps: 200,
    interestPerMonthBps: 100,
    now: new Date("2026-05-26T00:00:00Z"),
  });
  assert.equal(result.daysLate, 30);
  assert.equal(result.feeInCents, 400, "multa 2% sobre R$ 200 = R$ 4");
  assert.equal(result.interestInCents, 200, "juros 1% × 1 mês = R$ 2");
  assert.equal(result.totalInCents, 20600);
});

test("calculateReceivableFees: vencido 60 dias → multa 1x, juros 2x", () => {
  // R$ 100 vencido 60 dias = 2 meses
  // Multa: 100 × 2% = R$ 2 (uma vez)
  // Juros: 100 × 1% × 2 = R$ 2
  // Total: R$ 104
  const result = calculateReceivableFees({
    principalInCents: 10000,
    dueDate: new Date("2026-03-27T00:00:00Z"),
    lateFeeBps: 200,
    interestPerMonthBps: 100,
    now: new Date("2026-05-26T00:00:00Z"),
  });
  assert.equal(result.feeInCents, 200);
  assert.equal(result.interestInCents, 200);
  assert.equal(result.totalInCents, 10400);
});

test("applyReceivablePayment: pagamento parcial abate juros→multa→principal", () => {
  // Saldo: R$ 200 principal + R$ 4 multa + R$ 2 juros = R$ 206.
  // Cliente paga R$ 100. Abate na ordem:
  // - juros R$ 2 → resta R$ 98
  // - multa R$ 4 → resta R$ 94
  // - principal R$ 94 → sobra principal R$ 106
  const result = applyReceivablePayment({
    paymentInCents: 10000,
    feeInCents: 400,
    interestInCents: 200,
    principalInCents: 20000,
  });
  assert.equal(result.appliedToInterest, 200);
  assert.equal(result.appliedToFee, 400);
  assert.equal(result.appliedToPrincipal, 9400);
  assert.equal(result.remainingInterest, 0);
  assert.equal(result.remainingFee, 0);
  assert.equal(result.remainingPrincipal, 10600);
});

test("applyReceivablePayment: pagamento integral zera tudo", () => {
  const result = applyReceivablePayment({
    paymentInCents: 20600,
    feeInCents: 400,
    interestInCents: 200,
    principalInCents: 20000,
  });
  assert.equal(result.remainingInterest, 0);
  assert.equal(result.remainingFee, 0);
  assert.equal(result.remainingPrincipal, 0);
});

test("applyReceivablePayment: pagamento insuficiente pra cobrir juros", () => {
  // Juros R$ 5, multa R$ 4, principal R$ 200. Cliente paga R$ 3 → abate
  // todo juros (R$ 3), resta R$ 2 juros + R$ 4 multa + R$ 200 principal.
  const result = applyReceivablePayment({
    paymentInCents: 300,
    feeInCents: 400,
    interestInCents: 500,
    principalInCents: 20000,
  });
  assert.equal(result.appliedToInterest, 300);
  assert.equal(result.appliedToFee, 0);
  assert.equal(result.appliedToPrincipal, 0);
  assert.equal(result.remainingInterest, 200);
});
