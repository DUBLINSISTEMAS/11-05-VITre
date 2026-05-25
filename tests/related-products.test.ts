import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loader = readFileSync("src/lib/storefront/related-products-loader.ts", "utf8");
const editPage = readFileSync("src/app/(admin)/admin/produtos/[id]/page.tsx", "utf8");
const sharedLoader = readFileSync("src/lib/storefront/_shared.ts", "utf8");
const rlsSql = readFileSync("supabase/sql/18_product_related_rls.sql", "utf8");

test("related products loader completes manual picks with automatic fallback", () => {
  assert.match(loader, /const manualIds/);
  assert.doesNotMatch(loader, /return attachPrimaryImage\(tx, storeId, related\);\n\s*}\n\n\s*\/\/ 2\. AUTO/);
  assert.match(loader, /related.length < limit/);
  assert.match(loader, /notInArray\(productTable\.id, excludedIds\)/);
});

test("related products loader appends automatic picks after manual picks", () => {
  const autoBlock = loader.match(/\/\/ 2\. AUTO[\s\S]*?\/\/ 3\. FALLBACK/)?.[0] ?? "";

  assert.doesNotMatch(autoBlock, /related = await tx/);
  assert.match(autoBlock, /related = \[\.\.\.related, \.\.\.categoryRelated\]/);
});

// PP1 Fase B (2026-05-25): /admin/produtos/[id]/page.tsx virou redirect
// puro pro drawer global. RelatedProductsCard saiu do edit page; reintroduzir
// dentro do ProductFormDrawer fica pendente como PP1.x — quando isso acontecer,
// reativar este teste apontando pro arquivo certo (provavelmente o drawer
// ou um sub-componente dele que use a mesma query candidateIds + inArray).
test.skip("admin related candidates cover query is limited to candidate product ids", () => {
  // Skipado intencionalmente. Reativar quando RelatedProductsCard for
  // reinjetado no ProductFormDrawer.
});

test("product_related RLS SQL keeps public read tenant-scoped instead of USING true", () => {
  assert.match(rlsSql, /CREATE POLICY product_related_public_read/);
  assert.doesNotMatch(rlsSql, /product_related_public_read[\s\S]*?USING \(true\)/);
  assert.match(rlsSql, /current_setting\('app\.current_store_id'/);
});



test("attachPrimaryImage fetches only primary image rows", () => {
  assert.match(sharedLoader, /eq\(productImageTable\.position, 0\)/);
  assert.doesNotMatch(sharedLoader, /orderBy\(asc\(productImageTable\.position\)\)/);
});
