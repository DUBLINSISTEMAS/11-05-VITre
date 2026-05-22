/**
 * Static-analysis tests para PDV / venda balcão (Fase 5 — ADR-0016).
 *
 * Combinação de:
 *   1. Zod schema execution (real safeParse) — valida rejeições/aceitações
 *   2. Source grep — invariantes estruturais da action que não dá pra
 *      validar sem rodar contra prod (RLS, advisory locks, INSERT order
 *      channel='balcao', etc).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createBalcaoSaleSchema,
  PAYMENT_METHOD_VALUES,
} from "../src/actions/order/balcao/schema";

// ---------------------------------------------------------------------
// Zod schema — comportamento real
// ---------------------------------------------------------------------

function validBase() {
  return {
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    paymentMethod: "cash" as const,
    discountInCents: null,
    // ADR-0020 — campo obrigatório do schema (nullable, mas precisa estar
    // presente). Default null = sem acréscimo.
    surchargeInCents: null,
    cashReceivedInCents: null,
    notes: null,
  };
}

test("createBalcaoSaleSchema aceita venda mínima (1 item, cash, sem cliente)", () => {
  const r = createBalcaoSaleSchema.safeParse(validBase());
  assert.equal(r.success, true);
});

test("createBalcaoSaleSchema rejeita carrinho vazio", () => {
  const r = createBalcaoSaleSchema.safeParse({ ...validBase(), items: [] });
  assert.equal(r.success, false);
});

test("createBalcaoSaleSchema rejeita quantity 0 ou negativa", () => {
  const r0 = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", variantId: null, quantity: 0 }],
  });
  assert.equal(r0.success, false);
  const rNeg = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", variantId: null, quantity: -1 }],
  });
  assert.equal(rNeg.success, false);
});

test("createBalcaoSaleSchema rejeita paymentMethod fora do enum", () => {
  // safeParse aceita unknown — não usar @ts-expect-error (não dispararia
  // erro TS e geraria TS2578 no build).
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    paymentMethod: "boleto",
  });
  assert.equal(r.success, false);
});

test("createBalcaoSaleSchema aceita todos os 5 paymentMethods válidos", () => {
  for (const pm of PAYMENT_METHOD_VALUES) {
    const r = createBalcaoSaleSchema.safeParse({
      ...validBase(),
      paymentMethod: pm,
      // cashReceived só faz sentido com cash — limpa pros outros
      cashReceivedInCents: pm === "cash" ? null : null,
    });
    assert.equal(r.success, true, `Expected ${pm} to be valid`);
  }
});

test("createBalcaoSaleSchema rejeita cashReceived com paymentMethod != cash", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    paymentMethod: "pix",
    cashReceivedInCents: 10000,
  });
  assert.equal(r.success, false);
  if (!r.success) {
    const issue = r.error.issues.find((i) =>
      i.path.includes("cashReceivedInCents"),
    );
    assert.ok(
      issue,
      "Esperava issue no path cashReceivedInCents com message contextualizada",
    );
  }
});

test("createBalcaoSaleSchema rejeita discount negativo", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    discountInCents: -100,
  });
  assert.equal(r.success, false);
});

test("createBalcaoSaleSchema aceita customerId UUID válido", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  });
  assert.equal(r.success, true);
});

test("createBalcaoSaleSchema rejeita notes > 500 chars", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    notes: "x".repeat(501),
  });
  assert.equal(r.success, false);
});

test("createBalcaoSaleSchema aceita até 99 items, rejeita 100", () => {
  const items = Array.from({ length: 99 }, () => ({
    productId: "550e8400-e29b-41d4-a716-446655440000",
    variantId: null,
    quantity: 1,
  }));
  const r99 = createBalcaoSaleSchema.safeParse({ ...validBase(), items });
  assert.equal(r99.success, true);
  const r100 = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [...items, items[0]!],
  });
  assert.equal(r100.success, false);
});

// ---------------------------------------------------------------------
// Sprint 1A — multipayment via payments[]
// ---------------------------------------------------------------------

function validBaseWithPayments(overrides?: Partial<{ payments: unknown }>) {
  const base = {
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  };
  return { ...base, ...overrides };
}

test("Sprint 1A: createBalcaoSaleSchema aceita payments[] com 2 formas (pix + cash)", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "pix", amountInCents: 5000 },
        { method: "cash", amountInCents: 5000, cashReceivedInCents: 6000 },
      ],
    }),
  );
  assert.equal(r.success, true, JSON.stringify(r));
});

test("Sprint 1A: createBalcaoSaleSchema aceita payments[] com 3 formas", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "credit", amountInCents: 4000 },
        { method: "pix", amountInCents: 3000 },
        { method: "cash", amountInCents: 3000, cashReceivedInCents: 3000 },
      ],
    }),
  );
  assert.equal(r.success, true);
});

test("Sprint 1A: createBalcaoSaleSchema aceita payments[] com 5 formas (limite)", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "cash", amountInCents: 1000, cashReceivedInCents: 1000 },
        { method: "pix", amountInCents: 1000 },
        { method: "credit", amountInCents: 1000 },
        { method: "debit", amountInCents: 1000 },
        { method: "other", amountInCents: 1000, notes: "vale" },
      ],
    }),
  );
  assert.equal(r.success, true);
});

test("Sprint 1A: createBalcaoSaleSchema rejeita payments[] com 6 formas", () => {
  const sixPayments = Array.from({ length: 6 }, () => ({
    method: "cash" as const,
    amountInCents: 1000,
  }));
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({ payments: sixPayments }),
  );
  assert.equal(r.success, false);
});

test("Sprint 1A: createBalcaoSaleSchema rejeita payments[] vazio", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({ payments: [] }),
  );
  assert.equal(r.success, false);
});

test("Sprint 1A: createBalcaoSaleSchema rejeita payments[] sem nenhum pagamento e sem paymentMethod legado", () => {
  const r = createBalcaoSaleSchema.safeParse(validBaseWithPayments({}));
  assert.equal(r.success, false);
  if (!r.success) {
    const issue = r.error.issues.find((i) => i.path.includes("payments"));
    assert.ok(issue, "Esperava issue no path payments");
  }
});

test("Sprint 1A: paymentLine rejeita cashReceived em method != cash", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "pix", amountInCents: 5000, cashReceivedInCents: 5000 },
      ],
    }),
  );
  assert.equal(r.success, false);
});

test("Sprint 1A: paymentLine rejeita cashReceived menor que amount (cash)", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "cash", amountInCents: 10000, cashReceivedInCents: 5000 },
      ],
    }),
  );
  assert.equal(r.success, false);
});

test("Sprint 1A: paymentLine rejeita amount zero ou negativo", () => {
  const rZero = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [{ method: "cash", amountInCents: 0 }],
    }),
  );
  assert.equal(rZero.success, false);
  const rNeg = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [{ method: "cash", amountInCents: -100 }],
    }),
  );
  assert.equal(rNeg.success, false);
});

test("Sprint 1A: paymentLine rejeita notes > 60 chars", () => {
  const r = createBalcaoSaleSchema.safeParse(
    validBaseWithPayments({
      payments: [
        { method: "other", amountInCents: 5000, notes: "x".repeat(61) },
      ],
    }),
  );
  assert.equal(r.success, false);
});

// Sprint 1A Fase 4 — Quote mode -----------------------------------------

test("Sprint 1A Fase 4: createBalcaoSaleSchema aceita mode='quote' sem payments", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, true, JSON.stringify(r));
});

test("Sprint 1A Fase 4: createBalcaoSaleSchema aceita mode='quote' com customerId null", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 2,
      },
    ],
    customerId: null,
    quoteValidityDays: 14,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, true);
});

test("Sprint 1A Fase 4: createBalcaoSaleSchema rejeita mode='quote' com payments[]", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    payments: [{ method: "cash", amountInCents: 5000 }],
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, false);
});

test("Sprint 1A Fase 4: createBalcaoSaleSchema rejeita mode='quote' com paymentMethod legado", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    paymentMethod: "cash",
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, false);
});

test("Sprint 1A Fase 4: quoteValidityDays default 7, rejeita 0 ou 366", () => {
  // Default 7 — não passa quoteValidityDays
  const rDefault = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(rDefault.success, true);
  if (rDefault.success) {
    assert.equal(rDefault.data.quoteValidityDays, 7);
  }

  const rZero = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    quoteValidityDays: 0,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(rZero.success, false);

  const rTooMany = createBalcaoSaleSchema.safeParse({
    mode: "quote",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    quoteValidityDays: 366,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(rTooMany.success, false);
});

// Sprint 1A Fase 5 — Fiado mode ------------------------------------------

test("Sprint 1A Fase 5: createBalcaoSaleSchema aceita mode='fiado' com customerId", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "fiado",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, true, JSON.stringify(r));
});

test("Sprint 1A Fase 5: createBalcaoSaleSchema rejeita mode='fiado' sem customerId", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "fiado",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, false);
  if (!r.success) {
    const issue = r.error.issues.find((i) => i.path.includes("customerId"));
    assert.ok(issue, "Esperava issue no path customerId");
  }
});

test("Sprint 1A Fase 5: createBalcaoSaleSchema rejeita mode='fiado' com payments[]", () => {
  const r = createBalcaoSaleSchema.safeParse({
    mode: "fiado",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    payments: [{ method: "cash", amountInCents: 5000 }],
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, false);
});

test("Sprint 1A Fase 5: dueDaysFromNow default 30, rejeita 0 ou 366", () => {
  const rDefault = createBalcaoSaleSchema.safeParse({
    mode: "fiado",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(rDefault.success, true);
  if (rDefault.success) {
    assert.equal(rDefault.data.dueDaysFromNow, 30);
  }

  const rZero = createBalcaoSaleSchema.safeParse({
    mode: "fiado",
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    dueDaysFromNow: 0,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(rZero.success, false);
});

test("Sprint 1A: createBalcaoSaleSchema aceita backward-compat (paymentMethod único, sem payments)", () => {
  const r = createBalcaoSaleSchema.safeParse({
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
    customerId: null,
    paymentMethod: "cash" as const,
    cashReceivedInCents: null,
    discountInCents: null,
    surchargeInCents: null,
    notes: null,
  });
  assert.equal(r.success, true);
});

// ---------------------------------------------------------------------
// Action source — invariantes estruturais
// ---------------------------------------------------------------------

function loadActionSource(): string {
  return readFileSync(
    "src/actions/order/balcao/create-balcao-sale.ts",
    "utf8",
  );
}

test("createBalcaoSale exige autenticação (auth.api.getSession + UNAUTHORIZED)", () => {
  const s = loadActionSource();
  assert.match(s, /auth\.api\.getSession/);
  assert.match(s, /errorCode:\s*["']UNAUTHORIZED["']/);
});

test("createBalcaoSale aplica rate limit mutation por userId", () => {
  const s = loadActionSource();
  assert.match(s, /rateLimits\.mutation/);
  assert.match(s, /checkRateLimit\(rateLimits\.mutation,\s*userId\)/);
});

test("createBalcaoSale usa withTenant(storeId, userId) — RLS owner-only", () => {
  const s = loadActionSource();
  assert.match(s, /withTenant<CreateBalcaoSaleResult>\(/);
  assert.match(s, /store\.id,\s*\n?\s*userId,/);
});

test("createBalcaoSale adquire advisory lock por entidade antes do INSERT movement", () => {
  const s = loadActionSource();
  assert.match(s, /pg_advisory_xact_lock/);
  // lock antes da releitura do cache + INSERT
  const lockIdx = s.indexOf("pg_advisory_xact_lock");
  const recordIdx = s.indexOf("recordSaleMovements");
  assert.ok(lockIdx > 0 && recordIdx > 0 && lockIdx < recordIdx);
});

test("createBalcaoSale INSERT order tem channel='balcao' E status='fulfilled'", () => {
  const s = loadActionSource();
  assert.match(s, /channel:\s*["']balcao["']/);
  assert.match(s, /status:\s*["']fulfilled["']/);
});

test("createBalcaoSale passa expiresAt=null (PDV não expira)", () => {
  const s = loadActionSource();
  assert.match(s, /expiresAt:\s*null/);
});

test("createBalcaoSale registra stock_movement via helper compartilhado", () => {
  const s = loadActionSource();
  assert.match(s, /recordSaleMovements\(/);
  // helper compartilhado com checkout WhatsApp (Fase 4)
  assert.match(s, /@\/lib\/order\/record-sale-movements/);
});

test("createBalcaoSale invalida cache da loja após sucesso", () => {
  const s = loadActionSource();
  assert.match(s, /revalidateTag\(`store-\$\{[^}]+\}`\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/estoque["']\)/);
});

test("createBalcaoSale erro tipado pra cliente não encontrado", () => {
  const s = loadActionSource();
  assert.match(s, /errorCode:\s*["']CUSTOMER_NOT_FOUND["']/);
});

test("createBalcaoSale erro tipado pra cash_received insuficiente", () => {
  const s = loadActionSource();
  assert.match(s, /errorCode:\s*["']CASH_RECEIVED_TOO_LOW["']/);
});

test("createBalcaoSale erro tipado pra desconto > subtotal", () => {
  const s = loadActionSource();
  assert.match(s, /errorCode:\s*["']DISCOUNT_OVER_TOTAL["']/);
});

test("createBalcaoSale aceita variant ou produto sem trackStock como no-op de movement", () => {
  const s = loadActionSource();
  assert.match(s, /continue;.*\/\/ estoque ilimitado/);
});

test("createBalcaoSale idempotency key gerada server-side (randomUUID)", () => {
  const s = loadActionSource();
  assert.match(s, /randomUUID\(\)/);
});

// Sprint 1A — multipayment source-level invariants

test("Sprint 1A: createBalcaoSale importa e usa orderPaymentTable", () => {
  const s = loadActionSource();
  assert.match(s, /orderPaymentTable/);
  assert.match(s, /innerTx\.insert\(orderPaymentTable\)/);
});

test("Sprint 1A: createBalcaoSale tem error code PAYMENTS_SUM_MISMATCH", () => {
  const s = loadActionSource();
  assert.match(s, /PAYMENTS_SUM_MISMATCH/);
});

test("Sprint 1A: createBalcaoSale normaliza legacy paymentMethod -> payments[]", () => {
  const s = loadActionSource();
  // Branch que constrói payments quando recebe paymentMethod legado
  assert.match(s, /data\.paymentMethod/);
  assert.match(s, /balcao\.legacy_payment_payload/);
});

test("Sprint 1A: createBalcaoSale valida sum(payments) === totalInCents", () => {
  // Sprint 4C — fórmula virou paymentsSum + creditAmount === totalInCents
  // pra acomodar fiado parcial dentro de mode='sale'. Quando não há fiado
  // (creditAmount=0), comportamento idêntico ao original.
  const s = loadActionSource();
  assert.match(s, /paymentsSum/);
  assert.match(s, /paymentsSum\s*\+\s*creditAmountInCents\s*!==\s*totalInCents/);
});

test("Sprint 4C: createBalcaoSale aceita fiado parcial via creditAmountInCents", () => {
  const s = loadActionSource();
  assert.match(s, /creditAmountInCents\s*=\s*data\.creditAmountInCents/);
  assert.match(s, /hasCredit/);
  assert.match(s, /if\s*\(hasCredit\)/);
  assert.match(s, /amountInCents:\s*creditAmountInCents/);
});

test("Sprint 4C: createBalcaoSale exige customerId quando creditAmount > 0", () => {
  const s = loadActionSource();
  assert.match(s, /CUSTOMER_REQUIRED_FOR_FIADO/);
  assert.match(s, /Cliente obrigatório quando há saldo a fiado/);
});

test("Sprint 4C: createBalcaoSale pula INSERT orderPayment quando payments=[]", () => {
  const s = loadActionSource();
  assert.match(s, /if\s*\(payments\.length\s*>\s*0\)/);
});

// Sprint 1A Fase 4 — Quote source-level invariants

test("Sprint 1A Fase 4: createBalcaoSale tem branch para mode='quote'", () => {
  const s = loadActionSource();
  assert.match(s, /data\.mode\s*===\s*["']quote["']/);
});

test("Sprint 1A Fase 4: branch quote prefixa shortCode com 'Q-'", () => {
  const s = loadActionSource();
  assert.match(s, /["']Q-["']\s*\+\s*generateShortCode\(\)/);
});

test("Sprint 1A Fase 4: branch quote insere quoteValidUntil", () => {
  const s = loadActionSource();
  assert.match(s, /quoteValidUntil/);
  // E o cálculo de validade existe (data.quoteValidityDays vezes ms/dia)
  assert.match(s, /quoteValidityDays\s*\*\s*24/);
});

test("Sprint 1A Fase 5: createBalcaoSale tem branch para mode='fiado'", () => {
  const s = loadActionSource();
  assert.match(s, /data\.mode\s*===\s*["']fiado["']/);
});

test("Sprint 1A Fase 5: branch fiado INSERT em receivableTable", () => {
  const s = loadActionSource();
  assert.match(s, /receivableTable/);
  assert.match(s, /innerTx\.insert\(receivableTable\)/);
});

test("Sprint 1A Fase 5: branch fiado tem error code CUSTOMER_REQUIRED_FOR_FIADO", () => {
  const s = loadActionSource();
  assert.match(s, /CUSTOMER_REQUIRED_FOR_FIADO/);
});

test("Sprint 1A Fase 5: branch fiado chama recordSaleMovements (DESCONTA estoque)", () => {
  const s = loadActionSource();
  const fiadoBranchStart = s.indexOf('data.mode === "fiado"');
  assert.ok(fiadoBranchStart > 0, "Esperava branch fiado no source");
  const saleBranchStart = s.indexOf("// 10. Normalizar pagamento");
  assert.ok(saleBranchStart > fiadoBranchStart);
  const fiadoSlice = s.slice(fiadoBranchStart, saleBranchStart);
  assert.ok(
    fiadoSlice.includes("recordSaleMovements("),
    "Branch fiado DEVE chamar recordSaleMovements (cliente levou a peça)",
  );
  assert.ok(
    !fiadoSlice.includes("innerTx.insert(orderPaymentTable)"),
    "Branch fiado NÃO deve inserir orderPayment (não tem pagamento ainda)",
  );
});

test("Sprint 1A Fase 4: branch quote NÃO chama recordSaleMovements", () => {
  const s = loadActionSource();
  // Slice do branch quote: do `data.mode === "quote"` até o início do
  // próximo branch (fiado) OU normalização payments. Fiado adicionado
  // depois do quote, então marco fronteira no início do branch fiado.
  const quoteBranchStart = s.indexOf('data.mode === "quote"');
  assert.ok(quoteBranchStart > 0, "Esperava branch quote no source");
  const fiadoBranchStart = s.indexOf('data.mode === "fiado"');
  const saleBranchStart = s.indexOf("// 10. Normalizar pagamento");
  const quoteSliceEnd =
    fiadoBranchStart > quoteBranchStart ? fiadoBranchStart : saleBranchStart;
  assert.ok(quoteSliceEnd > quoteBranchStart);
  const quoteSlice = s.slice(quoteBranchStart, quoteSliceEnd);
  assert.ok(
    !quoteSlice.includes("recordSaleMovements("),
    "Branch quote não deve chamar recordSaleMovements (orçamento não desconta estoque)",
  );
  assert.ok(
    !quoteSlice.includes("innerTx.insert(orderPaymentTable)"),
    "Branch quote não deve inserir orderPayment",
  );
});

// ---------------------------------------------------------------------
// SQL 26 — CHECK constraints
// ---------------------------------------------------------------------

test("SQL 26 cria 4 CHECK constraints com nomes esperados", () => {
  const sql = readFileSync(
    "supabase/sql/26_pdv_check_constraints.sql",
    "utf8",
  );
  assert.match(sql, /order_balcao_requires_payment_method/);
  assert.match(sql, /order_discount_nonneg/);
  assert.match(sql, /order_cash_received_consistency/);
  assert.match(sql, /order_whatsapp_no_pos_fields/);
});

test("SQL 26 é idempotente (DROP IF EXISTS + IF NOT EXISTS)", () => {
  const sql = readFileSync(
    "supabase/sql/26_pdv_check_constraints.sql",
    "utf8",
  );
  const dropCount = (sql.match(/DROP CONSTRAINT IF EXISTS/g) || []).length;
  const guardCount = (sql.match(/IF NOT EXISTS/g) || []).length;
  assert.ok(dropCount >= 4, "esperado 4 DROP IF EXISTS");
  assert.ok(guardCount >= 4, "esperado 4 IF NOT EXISTS guards");
});

// ---------------------------------------------------------------------
// SQL 59 — desconto por item (per-item discount)
// ---------------------------------------------------------------------

test("balcaoItemSchema aceita discountInCents válido (0 ou positivo)", () => {
  const r0 = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 2,
        discountInCents: 0,
      },
    ],
  });
  assert.equal(r0.success, true);

  const rPositive = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 2,
        discountInCents: 500,
      },
    ],
  });
  assert.equal(rPositive.success, true);
});

test("balcaoItemSchema aceita discountInCents omitido (backward compat)", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
      },
    ],
  });
  assert.equal(r.success, true);
});

test("balcaoItemSchema rejeita discountInCents negativo", () => {
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    items: [
      {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        variantId: null,
        quantity: 1,
        discountInCents: -100,
      },
    ],
  });
  assert.equal(r.success, false);
});

test("Action create-balcao-sale persiste discountInCents em todos os 3 INSERTs (sale/quote/fiado)", () => {
  const s = loadActionSource();
  const matches = s.match(/discountInCents: ci\.itemDiscountInCents/g) ?? [];
  assert.equal(
    matches.length,
    3,
    `Esperava 3 inserções (sale + quote + fiado), achei ${matches.length}.`,
  );
});

test("Action create-balcao-sale valida desconto por linha > price × qty (ITEM_DISCOUNT_OVER_LINE)", () => {
  const s = loadActionSource();
  assert.ok(
    s.includes('errorCode: "ITEM_DISCOUNT_OVER_LINE"'),
    "Action precisa retornar ITEM_DISCOUNT_OVER_LINE quando rawItemDiscount > lineGross",
  );
  assert.ok(
    /rawItemDiscount\s*>\s*lineGross/.test(s),
    "Validação rawItemDiscount > lineGross deve existir no source",
  );
});

test("SQL 59 cria as 2 CHECK constraints esperadas (nonneg + not_above_line)", () => {
  const sql = readFileSync(
    "supabase/sql/59_order_item_discount.sql",
    "utf8",
  );
  assert.match(sql, /order_item_discount_nonneg/);
  assert.match(sql, /order_item_discount_not_above_line/);
  assert.match(
    sql,
    /discount_in_cents\s+<=\s+price_in_cents_snapshot\s+\*\s+quantity/,
    "CHECK upper bound deve referenciar price × qty",
  );
});

test("SQL 59 é idempotente (DROP IF EXISTS + IF NOT EXISTS)", () => {
  const sql = readFileSync(
    "supabase/sql/59_order_item_discount.sql",
    "utf8",
  );
  const dropCount = (sql.match(/DROP CONSTRAINT IF EXISTS/g) || []).length;
  const guardCount = (sql.match(/IF NOT EXISTS/g) || []).length;
  assert.ok(dropCount >= 2, "esperado 2 DROP IF EXISTS");
  assert.ok(guardCount >= 2, "esperado 2 IF NOT EXISTS guards");
});
