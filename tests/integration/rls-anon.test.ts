import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

// rls-anon precisa de Supabase REAL (anon key) — não funciona em Postgres
// ephemeral (CI). Skip quando NEXT_PUBLIC_SUPABASE_URL não tá setado, mesmo
// com RUN_INTEGRATION=1. CI roda rls-cross-tenant (que usa pg direto).
const skip =
  process.env.RUN_INTEGRATION !== "1" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sensitiveTables = [
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
] as const;

function createAnonClient() {
  assert.ok(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL precisa estar configurado",
  );
  assert.ok(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY precisa estar configurado",
  );

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

for (const table of sensitiveTables) {
  test(`anon não consegue SELECT em ${table}`, { skip }, async () => {
    const supabase = createAnonClient();

    const { data, error } = await supabase.from(table).select("*").limit(1);

    assert.ok(
      error,
      `Esperava erro de permissão em ${table}, recebi acesso com ${
        data?.length ?? 0
      } linha(s)`,
    );
  });
}
