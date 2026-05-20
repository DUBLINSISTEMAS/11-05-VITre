/**
 * Tests do audit log (Sprint 6A).
 *
 * Helper + integração no source de mutations sensíveis.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadHelperSource(): string {
  return readFileSync("src/lib/audit.ts", "utf8");
}

// ---------------------------------------------------------------------
// Helper recordAuditEvent — invariantes
// ---------------------------------------------------------------------

test("recordAuditEvent INSERT em audit_event", () => {
  const s = loadHelperSource();
  assert.match(s, /\.insert\(auditEventTable\)/);
});

test("recordAuditEvent NÃO faz throw em caso de erro (defensivo)", () => {
  const s = loadHelperSource();
  // Try/catch envolvendo o INSERT — logger.warn em vez de re-throw.
  assert.match(s, /try\s*\{[\s\S]*\.insert\(auditEventTable\)[\s\S]*\}\s*catch/);
  assert.match(s, /logger\.warn\("audit\.insert_failed"/);
});

test("extractClientContext lê x-forwarded-for + user-agent", () => {
  const s = loadHelperSource();
  assert.match(s, /x-forwarded-for/);
  assert.match(s, /user-agent/);
});

test("extractClientContext trunca IP em 64 chars e UA em 500", () => {
  const s = loadHelperSource();
  assert.match(s, /\.slice\(0,\s*64\)/);
  assert.match(s, /\.slice\(0,\s*500\)/);
});

// ---------------------------------------------------------------------
// Integração — mutations sensíveis chamam recordAuditEvent
// ---------------------------------------------------------------------

test("reverseReceivablePayment registra audit event", () => {
  const s = readFileSync(
    "src/actions/receivable/reverse-payment.ts",
    "utf8",
  );
  assert.match(s, /recordAuditEvent\(/);
  assert.match(s, /"receivable\.payment_reversed"/);
});

test("recordOrderReturn registra audit event", () => {
  const s = readFileSync("src/actions/order/record-return.ts", "utf8");
  assert.match(s, /recordAuditEvent\(/);
  assert.match(s, /"order\.return_recorded"/);
});

test("openCashSession registra audit event", () => {
  const s = readFileSync("src/actions/cash-session/open.ts", "utf8");
  assert.match(s, /recordAuditEvent\(/);
  assert.match(s, /"cash_session\.opened"/);
});

test("closeCashSession registra audit event com delta", () => {
  const s = readFileSync("src/actions/cash-session/close.ts", "utf8");
  assert.match(s, /recordAuditEvent\(/);
  assert.match(s, /"cash_session\.closed"/);
  assert.match(s, /deltaInCents/);
});
