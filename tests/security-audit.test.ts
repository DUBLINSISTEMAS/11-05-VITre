/**
 * Tests sentinela dos scripts de auditoria de segurança (Sprint 6D).
 *
 * Garante que:
 *   - smoke-idor cobre as tabelas críticas (regressão: alguém adiciona
 *     tabela sensível nova sem incluir no smoke).
 *   - audit-security-definer existe e está pronto pra rodar.
 *   - npm scripts expostos pra rodar localmente.
 *
 * Os scripts em si rodam contra prod — não cabem em unit test.
 * Anderson roda manualmente antes de cada deploy via npm run.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadIdorSource(): string {
  return readFileSync("scripts/smoke-idor.mjs", "utf8");
}

function loadDefinerSource(): string {
  return readFileSync("scripts/audit-security-definer.mjs", "utf8");
}

function loadPackageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readFileSync("package.json", "utf8"));
}

// ---------------------------------------------------------------------
// smoke-idor — cobertura de tabelas críticas
// ---------------------------------------------------------------------

const PRIVATE_MUST_COVER = [
  '"order"',
  "order_item",
  "order_payment",
  "order_return",
  "customer",
  "receivable",
  "receivable_payment",
  "cash_session",
  "cash_adjustment",
  "stock_movement",
  "supplier",
  "purchase",
  "purchase_item",
  "audit_event",
  "lead",
];

for (const tbl of PRIVATE_MUST_COVER) {
  test(`smoke-idor cobre tabela privada ${tbl}`, () => {
    const s = loadIdorSource();
    // tbl pode vir com aspas literais ("order" reservado SQL) ou sem.
    // Tenta ambas as variantes de quoting JS: 'X' e "X".
    const variants = [`'${tbl}'`, `"${tbl}"`];
    const found = variants.some((v) => s.includes(v));
    assert.ok(
      found,
      `smoke-idor não menciona ${tbl} em ${variants.join(" nem ")}`,
    );
  });
}

test("smoke-idor cobre as 5 tabelas com public_read_active", () => {
  const s = loadIdorSource();
  // ADR-0008 — storefront público sem login
  assert.match(s, /name:\s*"store"/);
  assert.match(s, /name:\s*"product"/);
  assert.match(s, /name:\s*"product_variant"/);
  assert.match(s, /name:\s*"category"/);
  assert.match(s, /name:\s*"banner"/);
});

test("smoke-idor usa role vitre_app (não bypassrls)", () => {
  const s = loadIdorSource();
  // DATABASE_URL = pool vitre_app (NOBYPASSRLS), NÃO DIRECT_URL (postgres BYPASSRLS)
  assert.match(s, /DATABASE_URL/);
  assert.doesNotMatch(s, /DIRECT_URL/);
});

test("smoke-idor falha (exit 1) quando detecta vazamento", () => {
  const s = loadIdorSource();
  assert.match(s, /process\.exit\(1\)/);
});

// ---------------------------------------------------------------------
// audit-security-definer
// ---------------------------------------------------------------------

test("audit-security-definer filtra schemas internos do Supabase", () => {
  const s = loadDefinerSource();
  // Não deve listar functions de schemas que não controlamos
  assert.match(s, /pg_catalog/);
  assert.match(s, /information_schema/);
  assert.match(s, /storage/);
  assert.match(s, /auth/);
});

test("audit-security-definer query usa prosecdef = true", () => {
  const s = loadDefinerSource();
  assert.match(s, /prosecdef\s*=\s*true/);
});

// ---------------------------------------------------------------------
// package.json — scripts expostos
// ---------------------------------------------------------------------

test("npm script db:smoke-idor está exposto", () => {
  const pkg = loadPackageJson();
  assert.equal(typeof pkg.scripts["db:smoke-idor"], "string");
  assert.match(pkg.scripts["db:smoke-idor"]!, /smoke-idor\.mjs/);
});

test("npm script db:audit-definer está exposto", () => {
  const pkg = loadPackageJson();
  assert.equal(typeof pkg.scripts["db:audit-definer"], "string");
  assert.match(pkg.scripts["db:audit-definer"]!, /audit-security-definer\.mjs/);
});
