import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCashDiscount,
  formatInstallments,
  type PaymentConfig,
  resolveCashDiscountBps,
} from "../src/lib/pricing";

// ---------------------------------------------------------------------
// Fixtures — ADR-0013 (Fase 2 pagamento configurável)
// ---------------------------------------------------------------------

const FULL_OPEN: PaymentConfig = {
  acceptsCard: true,
  cardMaxInstallments: 3,
  installmentBasePrice: "base",
  showInstallmentsOnPDP: true,
};

// ---------------------------------------------------------------------
// formatInstallments — gates (retorno "" suprime label no PDP)
// ---------------------------------------------------------------------

test("formatInstallments: acceptsCard=false suprime label mesmo com tudo on", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: {
      ...FULL_OPEN,
      acceptsCard: false,
      cardMaxInstallments: 12,
      showInstallmentsOnPDP: true,
    },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "");
});

test("formatInstallments: showInstallmentsOnPDP=false suprime label", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: { ...FULL_OPEN, showInstallmentsOnPDP: false },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "");
});

test("formatInstallments: cardMaxInstallments=1 suprime label (1× é ruído)", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: { ...FULL_OPEN, cardMaxInstallments: 1 },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "");
});

test("formatInstallments: productInstallmentsOverride=1 sobrescreve e suprime", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: { ...FULL_OPEN, cardMaxInstallments: 10 },
    productInstallmentsOverride: 1,
  });
  assert.equal(out, "");
});

test("formatInstallments: basePriceInCents=0 suprime label", () => {
  const out = formatInstallments({
    basePriceInCents: 0,
    effectivePriceInCents: 0,
    storePayment: FULL_OPEN,
    productInstallmentsOverride: null,
  });
  assert.equal(out, "");
});

// ---------------------------------------------------------------------
// formatInstallments — cálculo
// ---------------------------------------------------------------------

test("formatInstallments: base=15000 max=3 → 3× R$ 50,00", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: FULL_OPEN,
    productInstallmentsOverride: null,
  });
  assert.equal(out, "ou 3× de R$ 50,00 sem juros");
});

test("formatInstallments: installmentBasePrice=base preserva preço cheio com promo ativa", () => {
  // base=R$ 150 cheio, effective=R$ 100 (promo). "base" → divide 150/3 = 50.
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 10000,
    storePayment: { ...FULL_OPEN, installmentBasePrice: "base" },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "ou 3× de R$ 50,00 sem juros");
});

test("formatInstallments: installmentBasePrice=effective divide pelo promo", () => {
  // base=150, effective=100, "effective" → 100/3 = 33,33.
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 10000,
    storePayment: { ...FULL_OPEN, installmentBasePrice: "effective" },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "ou 3× de R$ 33,33 sem juros");
});

test("formatInstallments: override>=2 vence default da loja", () => {
  // Loja default 3x, produto pede 10x: renderiza 10×.
  const out = formatInstallments({
    basePriceInCents: 480000, // aliança R$ 4.800
    effectivePriceInCents: 480000,
    storePayment: { ...FULL_OPEN, cardMaxInstallments: 3 },
    productInstallmentsOverride: 10,
  });
  assert.equal(out, "ou 10× de R$ 480,00 sem juros");
});

test("formatInstallments: override=null usa cardMaxInstallments da loja", () => {
  const out = formatInstallments({
    basePriceInCents: 15000,
    effectivePriceInCents: 15000,
    storePayment: { ...FULL_OPEN, cardMaxInstallments: 6 },
    productInstallmentsOverride: null,
  });
  assert.equal(out, "ou 6× de R$ 25,00 sem juros");
});

// ---------------------------------------------------------------------
// formatCashDiscount
// ---------------------------------------------------------------------

test("formatCashDiscount: bps=0 retorna null (sem desconto)", () => {
  assert.equal(formatCashDiscount(10000, 0), null);
});

test("formatCashDiscount: effective<=0 retorna null", () => {
  assert.equal(formatCashDiscount(0, 1000), null);
});

test("formatCashDiscount: 10% (1000bps) sobre R$ 100 = R$ 90 (10% off)", () => {
  const out = formatCashDiscount(10000, 1000);
  assert.deepEqual(out, {
    discountedCents: 9000,
    label: "à vista R$ 90,00 (10% off)",
  });
});

test("formatCashDiscount: 5.5% (550bps) renderiza percentual com decimal", () => {
  const out = formatCashDiscount(10000, 550);
  assert.deepEqual(out, {
    discountedCents: 9450,
    label: "à vista R$ 94,50 (5.5% off)",
  });
});

test("formatCashDiscount: 50% (5000bps) renderiza sem decimal", () => {
  const out = formatCashDiscount(10000, 5000);
  assert.deepEqual(out, {
    discountedCents: 5000,
    label: "à vista R$ 50,00 (50% off)",
  });
});

// ---------------------------------------------------------------------
// resolveCashDiscountBps — override por produto (refactor 2026-05-16)
// ---------------------------------------------------------------------

test("resolveCashDiscountBps: override=null usa o valor da loja", () => {
  assert.equal(resolveCashDiscountBps(500, null), 500);
});

test("resolveCashDiscountBps: override>0 substitui o valor da loja", () => {
  // Loja default 5%, produto encalhado: 20% pra queimar estoque.
  assert.equal(resolveCashDiscountBps(500, 2000), 2000);
});

test("resolveCashDiscountBps: override=0 desliga desconto mesmo com loja ativa", () => {
  // Produto com margem apertada — lojista DESLIGA o desconto explicitamente.
  // 0 é semanticamente diferente de null (= "usa loja").
  assert.equal(resolveCashDiscountBps(500, 0), 0);
});

test("resolveCashDiscountBps: loja=0 e override=null retorna 0 (sem desconto)", () => {
  assert.equal(resolveCashDiscountBps(0, null), 0);
});

test("resolveCashDiscountBps: loja=0 e override>0 ativa só pra este produto", () => {
  // Loja não tem desconto configurado, mas peça específica recebe 10%.
  assert.equal(resolveCashDiscountBps(0, 1000), 1000);
});

// ---------------------------------------------------------------------
// resolveCashDiscountBps + formatCashDiscount — composição (caso real PDP)
// ---------------------------------------------------------------------

test("PDP: loja=5%, override=20% → label usa 20%", () => {
  const bps = resolveCashDiscountBps(500, 2000);
  const out = formatCashDiscount(10000, bps);
  assert.deepEqual(out, {
    discountedCents: 8000,
    label: "à vista R$ 80,00 (20% off)",
  });
});

test("PDP: loja=5%, override=0 → null (label suprimida no PDP)", () => {
  const bps = resolveCashDiscountBps(500, 0);
  assert.equal(formatCashDiscount(10000, bps), null);
});
