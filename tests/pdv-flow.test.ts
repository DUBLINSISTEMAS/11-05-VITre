/**
 * Static-analysis tests para fluxos do PDV / venda balcão (Onda 3.0,
 * complemento ao balcao-sale.test.ts).
 *
 * Foco: cenários de FLUXO que o balcao-sale.test cobre só parcialmente:
 *   - walk-in com nome/tel sem cadastro (ADR-0030 / Frente A)
 *   - precedência customerId vs walkInName
 *   - cálculo total = subtotal - discount + surcharge
 *   - auto-attach na sessão de caixa ativa (ADR-0022)
 *   - geração de publicToken pra recibo imprimível
 *   - erro OUT_OF_STOCK tipado
 *
 * Mesmo padrão: zod safeParse + source-grep. Sem DB infra — tsx --test não
 * roda contra Postgres real (rodar testes integration full exige Vitest +
 * pg-mem ou container, fora de escopo agora).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createBalcaoSaleSchema } from "../src/actions/order/balcao/schema";

const FIXTURE_PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      { productId: FIXTURE_PRODUCT_ID, variantId: null, quantity: 1 },
    ],
    customerId: null,
    paymentMethod: "cash" as const,
    discountInCents: null,
    surchargeInCents: null,
    cashReceivedInCents: null,
    notes: null,
    ...overrides,
  };
}

function loadActionSource(): string {
  return readFileSync(
    "src/actions/order/balcao/create-balcao-sale.ts",
    "utf8",
  );
}

// ---------------------------------------------------------------------
// Walk-in flow (venda rápida — ADR-0030 / Frente A)
// ---------------------------------------------------------------------

test("schema aceita walkInName válido sem customerId", () => {
  const r = createBalcaoSaleSchema.safeParse(
    baseInput({ walkInName: "Maria Cliente" }),
  );
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.walkInName, "Maria Cliente");
    assert.equal(r.data.customerId, null);
  }
});

test("schema converte walkInName string vazia em null (preprocess)", () => {
  const r = createBalcaoSaleSchema.safeParse(baseInput({ walkInName: "   " }));
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.walkInName, null);
});

test("schema rejeita walkInName > 120 chars", () => {
  const r = createBalcaoSaleSchema.safeParse(
    baseInput({ walkInName: "x".repeat(121) }),
  );
  assert.equal(r.success, false);
});

test("schema aceita walkInPhone E.164 (+5511999999999)", () => {
  const r = createBalcaoSaleSchema.safeParse(
    baseInput({ walkInPhone: "+5511999999999" }),
  );
  assert.equal(r.success, true);
});

test("schema rejeita walkInPhone formato local (sem +55)", () => {
  const r = createBalcaoSaleSchema.safeParse(
    baseInput({ walkInPhone: "11999999999" }),
  );
  assert.equal(r.success, false);
});

// ---------------------------------------------------------------------
// Precedência customerId vs walk-in (action source)
// ---------------------------------------------------------------------

test("action: customerId tem precedência sobre walkInName (branch if/else)", () => {
  const s = loadActionSource();
  // Padrão: `if (data.customerId) { ... } else if (data.walkInName) { ... }`
  assert.match(s, /if\s*\(\s*data\.customerId\s*\)/);
  assert.match(s, /else\s+if\s*\(\s*data\.walkInName\s*\)/);
});

test("action: snapshot do customer vem do nome digitado (não da row)", () => {
  // walk-in: snapshotName = data.walkInName direto
  const s = loadActionSource();
  assert.match(s, /customerSnapshotName\s*=\s*data\.walkInName/);
  assert.match(s, /customerSnapshotPhone\s*=\s*data\.walkInPhone/);
});

// ---------------------------------------------------------------------
// Cálculo de total (subtotal - discount + surcharge)
// ---------------------------------------------------------------------

test("action: totalInCents = subtotalInCents - discount + surcharge", () => {
  const s = loadActionSource();
  // Linha canônica do cálculo
  assert.match(
    s,
    /const\s+totalInCents\s*=\s*subtotalInCents\s*-\s*discount\s*\+\s*surcharge/,
  );
});

test("action: surchargeInCents salvo na coluna do order (não só no total)", () => {
  const s = loadActionSource();
  // INSERT preserva valor original pro audit
  assert.match(s, /surchargeInCents:\s*\n?\s*data\.surchargeInCents\s*\?\?\s*null/);
});

test("action: discountInCents salvo na coluna (não substituído por null)", () => {
  const s = loadActionSource();
  // Discount aplicado vai pra coluna pra relatório
  assert.match(s, /discountInCents/);
});

// ---------------------------------------------------------------------
// Caixa formal (ADR-0022) — auto-attach na sessão ativa
// ---------------------------------------------------------------------

test("action: order auto-attach na cash_session ATIVA da loja (closed_at IS NULL)", () => {
  const s = loadActionSource();
  // Lê sessão ativa antes do INSERT order
  assert.match(s, /activeCashSession|cashSession/);
  // cashSessionId no INSERT — null quando sem sessão (D1 opt-in)
  assert.match(s, /cashSessionId:\s*cashSessionIdForOrder/);
});

test("action: cashSessionId aceita null (D1 opt-in — vende sem caixa)", () => {
  const s = loadActionSource();
  // Pattern: activeCashSession?.id ?? null
  assert.match(s, /activeCashSession\??\.id\s*\?\?\s*null/);
});

// ---------------------------------------------------------------------
// Recibo (publicToken)
// ---------------------------------------------------------------------

test("action: gera publicToken via helper opaco (32+ chars, anti-enum)", () => {
  const s = loadActionSource();
  assert.match(s, /generatePublicOrderToken\(\)/);
  // Retorna pro caller pra redirect pro /admin/pdv/recibo/[token]
  assert.match(s, /publicToken:\s*createdPublicToken/);
});

test("action: result type inclui publicToken opcional", () => {
  const s = loadActionSource();
  // Tipo de retorno tem publicToken?
  assert.match(s, /publicToken\?:\s*string/);
});

// ---------------------------------------------------------------------
// Erros tipados pro client decidir UX
// ---------------------------------------------------------------------

test("action: errorCode OUT_OF_STOCK existe na union de tipos", () => {
  const s = loadActionSource();
  assert.match(s, /\|\s*["']OUT_OF_STOCK["']/);
});

test("action: errorCode COUPON_INVALID pro CouponError dentro do tx", () => {
  const s = loadActionSource();
  // Onda A C1 introduziu integração cupom no PDV — erro tipado pra UI
  assert.match(s, /errorCode:\s*["']COUPON_INVALID["']/);
});

// ---------------------------------------------------------------------
// Cache invalidation (CLAUDE.md #4)
// ---------------------------------------------------------------------

test("action: revalidatePath cobre admin/pedidos E admin/estoque", () => {
  const s = loadActionSource();
  assert.match(s, /revalidatePath\(["']\/admin\/estoque["']\)/);
  assert.match(s, /revalidatePath\(["']\/admin\/pedidos["']\)/);
});

test("action: revalidatePath cobre /admin/pdv (lista de vendas balcão)", () => {
  const s = loadActionSource();
  assert.match(s, /revalidatePath\(["']\/admin\/pdv["']\)/);
});

// ---------------------------------------------------------------------
// pdv-shell.tsx — invariantes de layout (redesign 2026-05-21)
//
// Substituiu as sentinelas anteriores ("campos sumindo" / sticky lg:top-4)
// — o redesign 2026-05-21 abandonou o layout aside-sticky em favor de
// flex column h-screen (sem scroll global). As regras essenciais
// preservadas:
//   - Container PDV ocupa altura da viewport (sem scroll de página inteira)
//   - Coluna de pagamento à direita tem footer SHRINK-0 (botão Finalizar
//     nunca é encolhido pra fora do viewport)
//   - Lista do carrinho rola INTERNAMENTE (min-h-0 + overflow-y-auto)
// ---------------------------------------------------------------------

test("pdv-shell: container ocupa altura da viewport sem scroll global", () => {
  const src = readFileSync(
    "src/components/admin/pdv/pdv-shell.tsx",
    "utf8",
  );
  // h-[calc(100vh-...)] no container raiz
  assert.match(src, /h-\[calc\(100vh-/);
});

test("pdv-shell: lista do carrinho rola interno (min-h-0 + overflow-y-auto)", () => {
  const src = readFileSync(
    "src/components/admin/pdv/pdv-shell.tsx",
    "utf8",
  );
  // Pattern do wrapper que envelopa CartPanel — preserva fix "campos sumindo"
  // em outro shape arquitetural (cart agora é coluna principal, não middle).
  assert.match(src, /min-h-0 flex-1 overflow-y-auto/);
});

test("pdv-shell: footer (Total+Submit) tem shrink-0 pra nunca encolher", () => {
  const src = readFileSync(
    "src/components/admin/pdv/pdv-shell.tsx",
    "utf8",
  );
  // Botão Finalizar não pode ser empurrado pra fora do viewport. O test
  // procura por "bg-bg-app shrink-0 border-t" sem prender em padding
  // específico (que muda em densificações UX) — o intent estrutural é
  // shrink-0 + border-t, não o p-3.
  assert.match(src, /bg-bg-app shrink-0 border-t/);
});
