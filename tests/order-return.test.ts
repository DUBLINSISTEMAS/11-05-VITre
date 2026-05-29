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

test("Sprint 2.1: recordOrderReturn aceita returnType partial + lista de items", () => {
  const s = loadActionSource();
  // Schema precisa expor enum full|partial e items array
  assert.match(
    s,
    /returnType:\s*z\.enum\(\["full",\s*"partial"\]\)/,
    "inputSchema deve aceitar returnType: 'full' | 'partial'",
  );
  // Aceita quebra de linha entre `z` e `.array` (formatação do Prettier).
  assert.match(
    s,
    /items:\s*z\s*\.array\(\s*z\.object\(\{\s*orderItemId/s,
    "inputSchema deve aceitar items: Array<{orderItemId, quantity}>",
  );
});

test("Sprint 2.1: partial valida saldo (qty <= vendida - já devolvida)", () => {
  const s = loadActionSource();
  // O código precisa calcular alreadyReturnedByItem e comparar com saldo
  assert.match(
    s,
    /alreadyReturnedByItem/,
    "deve acumular qty devolvida anteriormente por item",
  );
  assert.match(
    s,
    /saldo disponível/,
    "deve recusar com mensagem clara quando qty > saldo disponível",
  );
});

test("Sprint 2.1: order.status='returned' só quando saldo zera (orderFullyReturned)", () => {
  const s = loadActionSource();
  assert.match(
    s,
    /orderFullyReturned/,
    "deve calcular se devolução fechou o saldo total",
  );
  // UPDATE status='returned' fica dentro de if (orderFullyReturned)
  assert.match(
    s,
    /if\s*\(\s*orderFullyReturned\s*\)\s*\{[\s\S]*?status:\s*["']returned["']/,
    "UPDATE status='returned' precisa estar guardado por if (orderFullyReturned)",
  );
});

test("Sprint 2.1: partial chama restockOrderItemsPartial (não o helper full)", () => {
  const s = loadActionSource();
  assert.match(
    s,
    /restockOrderItemsPartial/,
    "branch partial deve invocar restockOrderItemsPartial",
  );
  // Pra full, segue usando restockOrderItems (genérico)
  assert.match(
    s,
    /restockOrderItems\(/,
    "branch full deve invocar restockOrderItems",
  );
});

test("Sprint 2.1: regra coexistência — full bloqueado após partial anterior", () => {
  const s = loadActionSource();
  assert.match(
    s,
    /hasPreviousPartial/,
    "código deve checar se já houve partial anterior",
  );
  assert.match(
    s,
    /devolução parcial/i,
    "mensagem de erro precisa orientar lojista a usar parcial pra continuar",
  );
});

test("Sprint 2.2: receivable pendente retorna errorCode='PENDING_RECEIVABLE' (não erro técnico)", () => {
  const s = loadActionSource();
  assert.match(
    s,
    /errorCode:\s*["']PENDING_RECEIVABLE["']/,
    "deve retornar errorCode estável pra UI rotear",
  );
  assert.match(
    s,
    /receivableId:\s*pendingReceivable\.id/,
    "deve devolver receivableId pra UI poder linkar",
  );
  // Calcula remainingInCents via JOIN com receivable_payment (não coluna)
  assert.match(
    s,
    /receivablePaymentTable\.amountInCents/,
    "deve calcular remainingInCents subtraindo soma dos receivable_payment",
  );
});

test("Sprint 2.1: UI OrderReturnDialog cobre full + partial + fiado guiado", () => {
  const ui = readFileSync(
    "src/components/admin/order-return-dialog.tsx",
    "utf8",
  );
  // 3 cenários cobertos pelo componente
  assert.match(ui, /mode === "full"/);
  assert.match(ui, /mode === "partial"/);
  assert.match(ui, /PENDING_RECEIVABLE/);
  // Saldo restante por item exibido na lista
  assert.match(
    ui,
    /it\.quantity - it\.quantityReturned/,
    "dialog deve calcular saldo (vendido - já devolvido)",
  );
  // Botão Abrir fiado leva pra tela consolidada de Financeiro tab=receber (L2).
  assert.match(
    ui,
    /\/admin\/financeiro\?tab=receber&receivable=/,
    "tela de fiado pendente deve linkar pra /admin/financeiro?tab=receber com receivableId",
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
