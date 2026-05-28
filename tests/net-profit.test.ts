import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateNetProfit,
  DEFAULT_STORE_FEES,
  type NetProfitInput,
  resolveCardFeeBps,
  type StoreFeeConfig,
} from "../src/lib/pricing/net-profit";

// ---------------------------------------------------------------------
// Helper canônico de lucro líquido por transação — Bloco C ressignificação
//
// 12 cenários cobrem matriz: método × parcelas × comissão × imposto ×
// custo zero × margem negativa × receita zero. Cada caso checa CADA
// componente do output (revenue, cost, paymentFee, commission, tax,
// netProfit, netMarginPct, effectiveCardFeeBps) — sem agregação cega.
//
// Convenção: TODOS valores em centavos. R$ 1.000 = 100_000 cents.
// ---------------------------------------------------------------------

const STORE_FEES: StoreFeeConfig = DEFAULT_STORE_FEES;

// Fixture base que cada teste reusa via spread + override:
const BASE: NetProfitInput = {
  revenueInCents: 100_000, // R$ 1.000
  costInCents: 60_000, // R$ 600
  paymentMethod: "pix",
  installments: 1,
  commissionBps: 0,
  taxBps: 0,
  storeFees: STORE_FEES,
};

// ---------------------------------------------------------------------
// 1. PIX à vista — sem taxa, sem comissão. Margem = (100 − 60) / 100 = 40%
// ---------------------------------------------------------------------
test("net-profit: PIX à vista sem comissão/imposto retorna margem bruta", () => {
  const out = calculateNetProfit(BASE);
  assert.equal(out.revenueInCents, 100_000);
  assert.equal(out.costInCents, 60_000);
  assert.equal(out.paymentFeeInCents, 0);
  assert.equal(out.commissionInCents, 0);
  assert.equal(out.taxInCents, 0);
  assert.equal(out.netProfitInCents, 40_000);
  assert.equal(out.netMarginPct, 40);
  assert.equal(out.effectiveCardFeeBps, 0);
});

// ---------------------------------------------------------------------
// 2. Débito — taxa 1.99% sobre receita
// ---------------------------------------------------------------------
test("net-profit: débito aplica taxa 1.99%", () => {
  const out = calculateNetProfit({ ...BASE, paymentMethod: "debit" });
  assert.equal(out.effectiveCardFeeBps, 199);
  assert.equal(out.paymentFeeInCents, 1_990); // 100_000 × 0.0199
  assert.equal(out.netProfitInCents, 100_000 - 60_000 - 1_990);
  assert.equal(out.netMarginPct, 38.01);
});

// ---------------------------------------------------------------------
// 3. Crédito 1x — taxa 3.50%
// ---------------------------------------------------------------------
test("net-profit: crédito 1x aplica taxa 3.50%", () => {
  const out = calculateNetProfit({
    ...BASE,
    paymentMethod: "credit",
    installments: 1,
  });
  assert.equal(out.effectiveCardFeeBps, 350);
  assert.equal(out.paymentFeeInCents, 3_500);
  assert.equal(out.netProfitInCents, 36_500);
});

// ---------------------------------------------------------------------
// 4. Crédito 6x — faixa 2-6x (5.99%)
// ---------------------------------------------------------------------
test("net-profit: crédito 6x usa faixa 2-6x (5.99%)", () => {
  const out = calculateNetProfit({
    ...BASE,
    paymentMethod: "credit",
    installments: 6,
  });
  assert.equal(out.effectiveCardFeeBps, 599);
  assert.equal(out.paymentFeeInCents, 5_990);
});

// ---------------------------------------------------------------------
// 5. Crédito 12x — faixa 7-12x (11.99%) — margem cai pra ~28%
// ---------------------------------------------------------------------
test("net-profit: crédito 12x usa faixa 7-12x (11.99%)", () => {
  const out = calculateNetProfit({
    ...BASE,
    paymentMethod: "credit",
    installments: 12,
  });
  assert.equal(out.effectiveCardFeeBps, 1199);
  assert.equal(out.paymentFeeInCents, 11_990);
  assert.equal(out.netProfitInCents, 100_000 - 60_000 - 11_990);
  assert.equal(out.netMarginPct, 28.01);
});

// ---------------------------------------------------------------------
// 6. PIX com comissão vendedora 5%
// ---------------------------------------------------------------------
test("net-profit: comissão 5% sobre receita bruta deduz 5_000", () => {
  const out = calculateNetProfit({ ...BASE, commissionBps: 500 });
  assert.equal(out.commissionInCents, 5_000);
  assert.equal(out.netProfitInCents, 35_000); // 100k − 60k − 0 − 5k
  assert.equal(out.netMarginPct, 35);
});

// ---------------------------------------------------------------------
// 7. Crédito 1x + comissão 5% + Simples Nacional 6%
// ---------------------------------------------------------------------
test("net-profit: crédito 1x + comissão + Simples soma corretamente", () => {
  const out = calculateNetProfit({
    ...BASE,
    paymentMethod: "credit",
    installments: 1,
    commissionBps: 500, // 5%
    taxBps: 600, // 6% Simples Nacional
  });
  assert.equal(out.paymentFeeInCents, 3_500);
  assert.equal(out.commissionInCents, 5_000);
  assert.equal(out.taxInCents, 6_000);
  assert.equal(out.netProfitInCents, 100_000 - 60_000 - 3_500 - 5_000 - 6_000);
  assert.equal(out.netMarginPct, 25.5); // 25.500 / 100.000 × 100
});

// ---------------------------------------------------------------------
// 8. Fiado — sem taxa cartão (cobrança vem depois via receivable_payment)
// ---------------------------------------------------------------------
test("net-profit: fiado não aplica taxa cartão (cobrança defere)", () => {
  const out = calculateNetProfit({ ...BASE, paymentMethod: "fiado" });
  assert.equal(out.effectiveCardFeeBps, 0);
  assert.equal(out.paymentFeeInCents, 0);
  assert.equal(out.netProfitInCents, 40_000);
});

// ---------------------------------------------------------------------
// 9. Cash com comissão 3% (lojista paga vendedora mesmo em venda à vista)
// ---------------------------------------------------------------------
test("net-profit: cash + comissão 3% deduz só comissão", () => {
  const out = calculateNetProfit({
    ...BASE,
    paymentMethod: "cash",
    commissionBps: 300,
  });
  assert.equal(out.paymentFeeInCents, 0);
  assert.equal(out.commissionInCents, 3_000);
  assert.equal(out.netProfitInCents, 37_000);
});

// ---------------------------------------------------------------------
// 10. Custo zero (produto sem custo cadastrado) — margem 100% bruta
// ---------------------------------------------------------------------
test("net-profit: custo zero produz margem 100% (caso 'produto sem custo')", () => {
  const out = calculateNetProfit({ ...BASE, costInCents: 0 });
  assert.equal(out.costInCents, 0);
  assert.equal(out.netProfitInCents, 100_000);
  assert.equal(out.netMarginPct, 100);
});

// ---------------------------------------------------------------------
// 11. Receita zero (devolução total) — evita divisão por zero
// ---------------------------------------------------------------------
test("net-profit: revenue zero retorna netMarginPct=0 (não Infinity)", () => {
  const out = calculateNetProfit({
    ...BASE,
    revenueInCents: 0,
    costInCents: 0,
  });
  assert.equal(out.netProfitInCents, 0);
  assert.equal(out.netMarginPct, 0);
  assert.ok(Number.isFinite(out.netMarginPct));
});

// ---------------------------------------------------------------------
// 12. Margem NEGATIVA — preço mata todas as taxas. Helper expõe, não silencia.
//     Aliança R$ 2.399, custo R$ 1.640, crédito 12x (11.99% = R$ 287),
//     comissão 5% (R$ 120), imposto 6% (R$ 144) → lucro R$ 208 (8.7%).
//     Caso real do joalheiro — comprime mas não vira negativa.
//     Pra forçar negativa, vou bombar comissão a 30% (caso extremo).
// ---------------------------------------------------------------------
test("net-profit: margem negativa é exposta sem clamp (matemática crua)", () => {
  const out = calculateNetProfit({
    revenueInCents: 239_900, // R$ 2.399
    costInCents: 164_000, // R$ 1.640
    paymentMethod: "credit",
    installments: 12,
    commissionBps: 3_000, // 30% — caso extremo de teste
    taxBps: 600, // 6% Simples
    storeFees: STORE_FEES,
  });
  assert.equal(out.paymentFeeInCents, Math.round((239_900 * 1199) / 10000));
  assert.equal(out.commissionInCents, Math.round((239_900 * 3000) / 10000));
  assert.equal(out.taxInCents, Math.round((239_900 * 600) / 10000));
  assert.ok(
    out.netProfitInCents < 0,
    `esperado margem negativa, recebeu ${out.netProfitInCents}`,
  );
  assert.ok(
    out.netMarginPct < 0,
    `esperado pct negativo, recebeu ${out.netMarginPct}`,
  );
});

// ---------------------------------------------------------------------
// Bônus — resolveCardFeeBps cobre métodos sem taxa
// ---------------------------------------------------------------------
test("resolveCardFeeBps: cash/pix/fiado/other retornam 0", () => {
  for (const m of ["cash", "pix", "fiado", "other"] as const) {
    assert.equal(resolveCardFeeBps(m, 1, STORE_FEES), 0);
    assert.equal(resolveCardFeeBps(m, 12, STORE_FEES), 0);
  }
});
