/**
 * Sentinela — bug fix 2026-05-21.
 *
 * Bug: CHECK `order_balcao_requires_payment_method` impedia INSERT de
 * orçamento (mode='quote'), fiado clássico (mode='fiado') e fiado 100%
 * (mode='sale' com creditAmount=total). Todos esses fluxos legítimos
 * inserem `paymentMethod=null` por design — order.payment_method virou
 * campo LEGADO desde Sprint 1A multipayment.
 *
 * Esta sentinela detecta:
 *   1. SQL 57 (DROP do CHECK) existe — alguém não pode "reverter".
 *   2. A action create-balcao-sale.ts continua passando paymentMethod:null
 *      nos branches quote e fiado (regressão semântica).
 *   3. Nenhum lugar do código tenta re-adicionar o CHECK obsoleto.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

function loadActionSource(): string {
  return readFileSync(
    "src/actions/order/balcao/create-balcao-sale.ts",
    "utf8",
  );
}

// ---------------------------------------------------------------------
// SQL 57 — DROP do CHECK obsoleto
// ---------------------------------------------------------------------

test("SQL 57 dropa order_balcao_requires_payment_method", () => {
  const files = readdirSync("supabase/sql");
  const sql57 = files.find((f) => f.startsWith("57_"));
  assert.ok(sql57, "SQL 57 não encontrado em supabase/sql");
  const content = readFileSync(`supabase/sql/${sql57}`, "utf8");
  assert.match(content, /DROP CONSTRAINT IF EXISTS order_balcao_requires_payment_method/);
});

test("Nenhum SQL re-adiciona order_balcao_requires_payment_method", () => {
  const files = readdirSync("supabase/sql");
  for (const f of files) {
    if (!f.endsWith(".sql")) continue;
    const content = readFileSync(`supabase/sql/${f}`, "utf8");
    if (content.includes("order_balcao_requires_payment_method")) {
      // SQL 57 é o ÚNICO permitido — ele faz DROP.
      assert.match(
        content,
        /DROP CONSTRAINT/,
        `${f} menciona o CHECK obsoleto sem ser DROP. Bug retorna se criar.`,
      );
    }
  }
});

// ---------------------------------------------------------------------
// Action — branches quote e fiado preservam paymentMethod: null
// ---------------------------------------------------------------------

test("branch quote insere paymentMethod: null", () => {
  const s = loadActionSource();
  // Procura o bloco do branch quote e confirma paymentMethod: null.
  // Match em multiline tolerante (pode estar formatado com whitespace).
  const idx = s.indexOf('status: "quote"');
  assert.ok(idx > -1, "Branch quote não encontrado");
  const block = s.slice(idx, idx + 600);
  assert.match(block, /paymentMethod:\s*null/);
});

test("branch fiado insere paymentMethod: null", () => {
  const s = loadActionSource();
  // Branch fiado tem o trio único: status='confirmed' + channel='balcao'
  // + paymentMethod=null + INSERT em receivableTable. Busca multiline
  // pelo INSERT do order seguido de paymentMethod: null antes do
  // receivable INSERT (provando que o branch insere sem método).
  const match = s.match(
    /status:\s*"confirmed"[\s\S]{0,300}channel:\s*"balcao"[\s\S]{0,300}paymentMethod:\s*null/,
  );
  assert.ok(match, "Branch fiado não passa paymentMethod: null no INSERT order");
});

test("branch sale com payments=[] (creditAmount=total) usa legacyPaymentMethod nullable", () => {
  const s = loadActionSource();
  // Sprint 4C: legacyPaymentMethod = payments[0]?.method ?? null
  // (era payments[0]!.method antes — não-nullable, quebrava com fiado 100%).
  assert.match(s, /legacyPaymentMethod\s*=\s*payments\[0\]\?\.method\s*\?\?\s*null/);
});

// ---------------------------------------------------------------------
// Bug 2026-05-21: cashSessionIdForOrder declarado DEPOIS do branch fiado
// causava ReferenceError (TDZ). Fix moveu lookup pra ANTES dos 3 branches.
// ---------------------------------------------------------------------

test("cashSessionIdForOrder é declarado ANTES do primeiro branch (TDZ fix)", () => {
  const s = loadActionSource();
  const declIdx = s.indexOf("const cashSessionIdForOrder");
  const firstUseIdx = s.indexOf("cashSessionId: cashSessionIdForOrder");
  assert.ok(declIdx > -1, "declaração não encontrada");
  assert.ok(firstUseIdx > -1, "uso não encontrado");
  assert.ok(
    declIdx < firstUseIdx,
    "cashSessionIdForOrder DEVE ser declarado antes do primeiro uso " +
      "(senão TDZ quebra branch fiado/quote/sale)",
  );
});

test("cashSessionIdForOrder declarado UMA vez (sem duplicação)", () => {
  const s = loadActionSource();
  const matches = s.match(/const cashSessionIdForOrder/g) ?? [];
  assert.equal(
    matches.length,
    1,
    `cashSessionIdForOrder declarado ${matches.length}× — manter UMA decl`,
  );
});
