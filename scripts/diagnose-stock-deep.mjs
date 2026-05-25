#!/usr/bin/env node
/**
 * Audit profundo do estoque — Onda 1.4 Passo 2 (2026-05-24).
 *
 * Verifica se as condições NECESSÁRIAS pra o stock_movement funcionar
 * estão de pé:
 *   1. Trigger sync_stock_cache_on_movement existe e qual versão?
 *   2. SECURITY DEFINER aplicado (SQL 60)?
 *   3. Function owner é postgres (role com BYPASSRLS)?
 *   4. Policies de stock_movement ativas?
 *   5. RLS FORCE habilitado na product e stock_movement?
 *   6. Role vitre_app tem GRANT INSERT em stock_movement?
 *   7. Conexão atual está usando qual role?
 *
 * USO: node --env-file=.env.local scripts/diagnose-stock-deep.mjs
 */
import pg from "pg";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL ou DATABASE_URL precisa estar setado em .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const usingUrl = url === process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL";
console.log(`=== AUDIT PROFUNDO DE ESTOQUE ===\n(conectado via ${usingUrl})\n`);

// 1) Role atual
const role = await client.query(`SELECT current_user, current_setting('is_superuser')`);
console.log(
  `[role] current_user=${role.rows[0].current_user}  is_superuser=${role.rows[0].current_setting}`,
);

// 2) Trigger existe?
const trig = await client.query(`
  SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
   WHERE tgname = 'stock_movement_sync_cache'
`);
console.log(`\n[trigger] stock_movement_sync_cache:`);
if (trig.rows.length === 0) {
  console.log("  ❌ NÃO EXISTE! Trigger não aplicado.");
} else {
  for (const r of trig.rows) {
    console.log(`  ✓ ${r.tgname} (enabled=${r.tgenabled})`);
    console.log(`    ${r.def}`);
  }
}

// 3) Função SECURITY DEFINER?
const func = await client.query(`
  SELECT proname, prosecdef, proowner::regrole AS owner, prosrc
    FROM pg_proc
   WHERE proname = 'sync_stock_cache_on_movement'
`);
console.log(`\n[function] sync_stock_cache_on_movement:`);
if (func.rows.length === 0) {
  console.log("  ❌ NÃO EXISTE!");
} else {
  for (const r of func.rows) {
    console.log(
      `  ✓ ${r.proname}  SECURITY DEFINER=${r.prosecdef}  owner=${r.owner}`,
    );
    console.log(`    src (primeiros 400 chars):`);
    console.log(`    ${(r.prosrc ?? "").slice(0, 400).replace(/\n/g, "\n    ")}`);
  }
}

// 4) RLS FORCE
const rls = await client.query(`
  SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
   WHERE relname IN ('stock_movement', 'product', 'product_variant')
   ORDER BY relname
`);
console.log(`\n[rls] RLS / FORCE:`);
for (const r of rls.rows) {
  console.log(
    `  ${r.relname}: enabled=${r.relrowsecurity}  forced=${r.relforcerowsecurity}`,
  );
}

// 5) Policies de stock_movement
const pol = await client.query(`
  SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS qual,
         pg_get_expr(polwithcheck, polrelid) AS wcheck
    FROM pg_policy
   WHERE polrelid = 'stock_movement'::regclass
`);
console.log(`\n[policies] stock_movement:`);
for (const r of pol.rows) {
  console.log(`  ${r.polname} (cmd=${r.polcmd})`);
  if (r.qual) console.log(`    USING: ${r.qual}`);
  if (r.wcheck) console.log(`    WITH CHECK: ${r.wcheck}`);
}

// 6) Grants pra vitre_app
const grants = await client.query(`
  SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
   WHERE table_name = 'stock_movement'
     AND grantee = 'vitre_app'
   ORDER BY privilege_type
`);
console.log(`\n[grants] stock_movement → vitre_app:`);
if (grants.rows.length === 0) {
  console.log("  ❌ NENHUM GRANT pra vitre_app!");
} else {
  for (const r of grants.rows) {
    console.log(`  ✓ ${r.privilege_type}`);
  }
}

// 7) Grants pra vitre_app na product (pra UPDATE do trigger)
const productGrants = await client.query(`
  SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
   WHERE table_name = 'product'
     AND grantee = 'vitre_app'
   ORDER BY privilege_type
`);
console.log(`\n[grants] product → vitre_app:`);
for (const r of productGrants.rows) {
  console.log(`  ✓ ${r.privilege_type}`);
}

// 8) Última row de stock_movement (se existir)
const last = await client.query(`
  SELECT id, store_id, product_id, variant_id, movement_type, quantity_delta,
         reference_type, notes, created_at
    FROM stock_movement
   ORDER BY created_at DESC
   LIMIT 5
`);
console.log(`\n[last 5 movements] (vazio se nada foi inserido):`);
for (const r of last.rows) {
  console.log(
    `  [${r.created_at.toISOString()}] ${r.movement_type} delta=${r.quantity_delta} product=${r.product_id} note="${r.notes}"`,
  );
}
if (last.rows.length === 0) console.log("  (vazio)");

// 9) Estado do produto Aliança
const alianca = await client.query(`
  SELECT id, name, track_stock, stock_quantity, updated_at
    FROM product
   WHERE name ILIKE '%aliança%' OR name ILIKE '%alianca%'
   LIMIT 5
`);
console.log(`\n[produto Aliança] estado atual:`);
for (const r of alianca.rows) {
  console.log(
    `  ${r.name}: track=${r.track_stock} qty=${r.stock_quantity} updated=${r.updated_at.toISOString()}`,
  );
}

await client.end();
