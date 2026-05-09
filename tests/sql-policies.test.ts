import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/sql/01_rls_setup.sql", "utf8");

function policyBlock(policyName: string): string {
  const start = sql.indexOf(`CREATE POLICY ${policyName}`);
  if (start === -1) return "";
  const next = sql.indexOf("CREATE POLICY", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

test("order RLS policies do not expose every order publicly", () => {
  assert.doesNotMatch(
    policyBlock("order_public_read_by_code"),
    /USING \(true\)/,
  );
});

test("order item RLS policies do not expose every item publicly", () => {
  assert.doesNotMatch(policyBlock("order_item_public_read"), /USING \(true\)/);
});

test("admin order status action uses tenant-scoped database access", () => {
  const action = readFileSync("src/actions/order/update-status.ts", "utf8");

  assert.match(action, /withTenant\(store\.id, userId/);
  assert.doesNotMatch(action, /import \{ db \} from "@\/db"/);
});

test("public order loader does not log public tokens in service role reason", () => {
  const loader = readFileSync("src/lib/storefront/order-loader.ts", "utf8");

  assert.doesNotMatch(loader, /publicToken=\$\{publicToken\}/);
  assert.doesNotMatch(loader, /shortCode=\$\{shortCode\}/);
});
