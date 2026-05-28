import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loader = readFileSync("src/lib/storefront/related-products-loader.ts", "utf8");
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

// Bloco A da ressignificação (2026-05-27): /admin/produtos/[id]/page.tsx
// deletada — drawer global passou a ser o único caminho de edição. UI de
// curadoria de produtos relacionados é pendência da Semana 5 (decisão
// founder: implementar product_related UI admin). Quando o componente
// entrar no drawer, reativar este teste apontando pro componente certo.
test.skip("admin related candidates cover query is limited to candidate product ids", () => {
  // Skipado intencionalmente. Reativar quando RelatedProductsCard for
  // reinjetado no ProductFormDrawer (Semana 5 da ressignificação).
});

test("product_related RLS SQL keeps public read tenant-scoped instead of USING true", () => {
  assert.match(rlsSql, /CREATE POLICY product_related_public_read/);
  assert.doesNotMatch(rlsSql, /product_related_public_read[\s\S]*?USING \(true\)/);
  assert.match(rlsSql, /current_setting\('app\.current_store_id'/);
});



test("attachPrimaryImage fetches only primary image rows", () => {
  // S1.5 (2026-05-26) — migrado de `eq(position, 0)` pra DISTINCT ON com
  // ORDER BY position ASC. Resolve edge case "imagem position 0 deletada,
  // ficou só 1,2,3 — produto sem imagem na home".
  //
  // 2026-05-27 (bugfix Sentry "Failed query ... ANY($2,$3,...)") — refator
  // de template-tag sql`...` pra query builder Drizzle: `selectDistinctOn`
  // + `inArray` parametriza array como `$1::uuid[]` (antes virava tupla
  // que o Postgres rejeitava com `parse_oper.c make_scalar_array_op`).
  // Semântica idêntica: DISTINCT ON (product_id) ORDER BY product_id,
  // position ASC, mas sem string literal SQL no código.
  assert.match(sharedLoader, /selectDistinctOn\(\[productImageTable\.productId\]/);
  assert.match(sharedLoader, /inArray\(productImageTable\.productId, productIds\)/);
  assert.match(sharedLoader, /asc\(productImageTable\.productId\)/);
  assert.match(sharedLoader, /asc\(productImageTable\.position\)/);
  // Garantia anti-regressão: NÃO voltar pro template-tag bugado (sql`...
  // ANY(${productIds})` aninhado dentro de tx.execute). Olha pelo
  // marcador `tx.execute(sql` que só aparece se voltar o padrão antigo.
  assert.doesNotMatch(sharedLoader, /tx\.execute\(sql`/);
});
