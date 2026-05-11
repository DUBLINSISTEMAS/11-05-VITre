/**
 * Checks that the Supabase anon role cannot read sensitive public-schema
 * tables through supabase-js + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *
 * Expected states:
 *   - Before applying SQL 15: fail if anon can SELECT any sensitive table.
 *   - After applying SQL 15: pass only when every table returns permission denied.
 *
 * Exit codes:
 *   0 = anon is blocked on every sensitive table.
 *   1 = anon successfully read at least one sensitive table.
 *   2 = inconclusive infrastructure/config error.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
  process.exit(2);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const SENSITIVE_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "order",
  "order_item",
  "store",
  "product",
  "category",
  "banner",
];

function isPermissionDenied(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "42501" || /permission denied/i.test(message);
}

console.log(`Probing ${SENSITIVE_TABLES.length} tables with anon key...\n`);

const readable = [];
const blocked = [];
const inconclusive = [];

for (const table of SENSITIVE_TABLES) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(1);

    if (!error) {
      readable.push({
        table,
        rowsReturned: Array.isArray(data) ? data.length : 0,
      });
      continue;
    }

    if (isPermissionDenied(error)) {
      blocked.push({ table, error: error.message || error.code || "denied" });
      continue;
    }

    inconclusive.push({
      table,
      code: error.code ?? null,
      message: error.message ?? String(error),
    });
  } catch (err) {
    inconclusive.push({ table, code: null, message: String(err) });
  }
}

if (inconclusive.length > 0) {
  console.error("INCONCLUSIVE CHECK: unexpected anon query error:\n");
  for (const item of inconclusive) {
    console.error(
      `   ${item.table.padEnd(20)} -> ${item.code ?? "no-code"} ${item.message}`,
    );
  }
  console.error("\nExpected Postgres 42501 / permission denied for every table.");
  process.exit(2);
}

if (readable.length > 0) {
  console.error("CRITICAL FAILURE: anon can read sensitive tables:\n");
  for (const item of readable) {
    console.error(
      `   ${item.table.padEnd(20)} -> SELECT returned ${item.rowsReturned} rows`,
    );
  }
  if (blocked.length > 0) {
    console.error(`\n(${blocked.length}/${SENSITIVE_TABLES.length} blocked correctly)`);
  }
  console.error("\nApply: supabase/sql/15_revoke_anon_grants.sql");
  process.exit(1);
}

console.log("anon cannot access any sensitive table.");
console.log(`   ${blocked.length}/${SENSITIVE_TABLES.length} blocked.\n`);
process.exit(0);
