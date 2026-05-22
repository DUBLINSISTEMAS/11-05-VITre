/**
 * Tests do domínio order_return (Pre-Sprint-6 C).
 *
 * Source-level invariants. Lojista registra devolução total de venda
 * confirmada/fulfilled.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadActionSource(): string {
  return readFileSync("src/actions/order/record-return.ts", "utf8");
}

function loadDetailSource(): string {
  return readFileSync("src/actions/order/load-detail.ts", "utf8");
}

function loadSchemaSource(): string {
  return readFileSync("src/actions/order/schema.ts", "utf8");
}

// ---------------------------------------------------------------------
// recordOrderReturn — invariantes
// ---------------------------------------------------------------------

test("recordOrderReturn usa withTenant", () => {
  const s = loadActionSource();
  assert.match(s, /withTenant<RecordOrderReturnResult>\(/);
});

test("recordOrderReturn aplica rate limit mutation", () => {
  const s = loadActionSource();
  assert.match(s, /checkRateLimit\(rateLimits\.mutation/);
});

test("recordOrderReturn adquire advisory lock por order", () => {
  const s = loadActionSource();
  assert.match(s, /pg_advisory_xact_lock.*order-return-/);
});

test("recordOrderReturn aceita só status confirmed/fulfilled (via constants.ts)", () => {
  // Sprint 1.3: RETURNABLE_STATUSES migrou pra src/actions/order/constants.ts.
  // record-return importa daqui — então a sentinela checa 2 coisas:
  //   1. O literal canônico continua sendo ["confirmed", "fulfilled"]
  //   2. record-return importa de "./constants" e usa isReturnable()
  const constants = readFileSync(
    "src/actions/order/constants.ts",
    "utf8",
  );
  assert.match(
    constants,
    /RETURNABLE_STATUSES\s*=\s*\[\s*"confirmed"\s*,\s*"fulfilled"\s*\]/s,
    "Literal canônico em constants.ts deve permanecer [confirmed, fulfilled]",
  );

  const action = loadActionSource();
  assert.match(
    action,
    /from\s+["']\.\/constants["']/,
    "record-return.ts deve importar de ./constants",
  );
  assert.match(
    action,
    /isReturnable\s*\(/,
    "record-return.ts deve usar o predicado isReturnable() em vez de .includes() manual",
  );
});

test("recordOrderReturn rejeita re-devolução (idempotência via status)", () => {
  const s = loadActionSource();
  assert.match(s, /Esta venda já foi devolvida/);
});

test("recordOrderReturn bloqueia se há receivable pendente", () => {
  const s = loadActionSource();
  assert.match(s, /fiado em aberto/);
  assert.match(s, /isNull\(receivableTable\.paidAt\)/);
});

test("recordOrderReturn INSERT order_return + order_return_item por item", () => {
  const s = loadActionSource();
  assert.match(s, /\.insert\(orderReturnTable\)/);
  assert.match(s, /\.insert\(orderReturnItemTable\)/);
});

test("recordOrderReturn restock via helper compartilhado", () => {
  const s = loadActionSource();
  assert.match(s, /restockOrderItems\(/);
});

test("recordOrderReturn UPDATE order.status='returned'", () => {
  const s = loadActionSource();
  assert.match(s, /\.update\(orderTable\)/);
  assert.match(s, /status:\s*["']returned["']/);
});

test("recordOrderReturn gera cash_adjustment 'other_out' espelho", () => {
  const s = loadActionSource();
  assert.match(s, /type:\s*["']other_out["']/);
});

test("recordOrderReturn revalida paths críticos", () => {
  const s = loadActionSource();
  assert.match(s, /revalidatePath\(`\/admin\/pedidos\/\$\{order\.id\}`\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/estoque["']\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/pdv\/caixa["']\)/);
});

test("recordOrderReturn rejeita motivo curto (< 3 chars)", () => {
  const s = loadActionSource();
  assert.match(s, /\.min\(3,\s*"Informe o motivo da devolução\./);
});

// ---------------------------------------------------------------------
// loadOrderDetail expõe returns[]
// ---------------------------------------------------------------------

test("loadOrderDetail traz lista de returns", () => {
  const s = loadDetailSource();
  assert.match(s, /returns:\s*OrderDetailReturn\[\]/);
  assert.match(s, /\.from\(orderReturnTable\)/);
});

// ---------------------------------------------------------------------
// ORDER_STATUS_VALUES inclui 'returned'
// ---------------------------------------------------------------------

test("ORDER_STATUS_VALUES inclui 'returned'", () => {
  const s = loadSchemaSource();
  assert.match(s, /ORDER_STATUS_VALUES\s*=\s*\[[\s\S]*"returned"[\s\S]*\]/);
});

test("VALID_TRANSITIONS.returned é array vazio (terminal)", () => {
  const s = loadSchemaSource();
  assert.match(s, /returned:\s*\[\]/);
});
