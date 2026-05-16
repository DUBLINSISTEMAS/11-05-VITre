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
  const r = createBalcaoSaleSchema.safeParse({
    ...validBase(),
    // @ts-expect-error — testando rejeição
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
