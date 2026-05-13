import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("product visibility updates stay tenant-scoped", () => {
  const action = readFileSync("src/actions/product/toggle-active.ts", "utf8");

  assert.match(action, /eq\(productTable\.storeId, store\.id\)/);
  assert.doesNotMatch(
    action,
    /\.where\(eq\(productTable\.id, parsed\.data\.productId\)\)/,
  );
});

test("product image mutations revalidate the public storefront cache", () => {
  const upload = readFileSync("src/actions/product/upload-image.ts", "utf8");
  const remove = readFileSync("src/actions/product/delete-image.ts", "utf8");

  assert.match(upload, /revalidateTag\(`store-\$\{store\.slug\}`\)/);
  assert.match(remove, /revalidateTag\(`store-\$\{store\.slug\}`\)/);
});

test("banner upload validates link through the shared Zod schema", () => {
  const action = readFileSync("src/actions/banner/upload.ts", "utf8");

  assert.match(action, /createBannerSchema\.safeParse/);
  assert.doesNotMatch(action, /const linkRaw = formData\.get\("link"\);\n  const link =/);
});

test("product image upload cleans the orphan .webp when DB insert fails", () => {
  const action = readFileSync("src/actions/product/upload-image.ts", "utf8");

  // Imports do helper de cleanup.
  assert.match(action, /deleteFromStorage/);
  assert.match(action, /extractStoragePath/);

  // Padrão try/finally: flag de sucesso + cleanup no finally.
  assert.match(action, /let dbInsertSucceeded = false/);
  assert.match(action, /dbInsertSucceeded = true/);
  assert.match(action, /finally\s*\{[\s\S]*?if \(!dbInsertSucceeded\)/);
  assert.match(
    action,
    /deleteFromStorage\(\s*\{\s*bucket:\s*"productImages"/,
  );

  // Sanidade: o TODO antigo ("imagem ficou órfã") foi removido — o
  // cleanup agora é eager, não deferido pra Fase 2.
  assert.doesNotMatch(action, /imagem ficou órfã/);
});

test("banner upload cleans the orphan .webp when DB insert fails", () => {
  const action = readFileSync("src/actions/banner/upload.ts", "utf8");

  assert.match(action, /deleteFromStorage/);
  assert.match(action, /extractStoragePath/);
  assert.match(action, /let dbInsertSucceeded = false/);
  assert.match(action, /dbInsertSucceeded = true/);
  assert.match(action, /finally\s*\{[\s\S]*?if \(!dbInsertSucceeded\)/);
  assert.match(
    action,
    /deleteFromStorage\(\s*\{\s*bucket:\s*"storeBanners"/,
  );
});

test("store creation inserts store and initial categories in one transaction", () => {
  const action = readFileSync("src/actions/store/create-store.ts", "utf8");

  assert.match(action, /await withTenant\("", userId, async \(tx\) => \{/);
  assert.match(action, /\.insert\(storeTable\)[\s\S]*tx\.insert\(categoryTable\)/);
  assert.match(action, /set_config\('app\.current_store_id', \$\{created\.id\}, true\)/);
  assert.doesNotMatch(action, /withTenant\(newStore\.id/);
});

test("new product page opens without creating a draft on open", () => {
  // Migrado 2026-05-12: modal → página dedicada /admin/produtos/novo.
  // Invariante crítica preservada: produto só persiste no submit
  // explícito (createProductFromValues), nunca por prefetch ou mount.
  const novoPage = readFileSync("src/app/(admin)/admin/produtos/novo/page.tsx", "utf8");
  const novoForm = readFileSync(
    "src/app/(admin)/admin/produtos/novo/new-product-form.tsx",
    "utf8",
  );
  const createButton = readFileSync(
    "src/components/admin/product-create-button.tsx",
    "utf8",
  );
  const productsPage = readFileSync("src/app/(admin)/admin/produtos/page.tsx", "utf8");
  const form = readFileSync("src/components/admin/product-form.tsx", "utf8");
  const uploader = readFileSync("src/components/admin/image-uploader.tsx", "utf8");

  // Botão "+ Novo produto" usa <Link prefetch>, sem state local nem
  // setDialog. Sem efeito colateral de criação no mount.
  assert.match(createButton, /href="\/admin\/produtos\/novo"/);
  assert.doesNotMatch(createButton, /setDialog/);

  // Página /admin/produtos/novo monta NewProductForm que passa
  // createProductFromValues — usado apenas no submit do form.
  assert.match(novoPage, /NewProductForm/);
  assert.match(novoForm, /createProductFromValues/);
  assert.match(novoForm, /onCreateProduct=\{createProductFromValues\}/);

  // Fluxo "Salvar e adicionar outro" continua client-only (sem novo fetch).
  assert.match(form, /onAfterSave\(\{ continueCreating: true \}\)/);
  assert.doesNotMatch(form, /saveAndCreateNext/);

  // Uploader nunca chama createDraftProduct nem ensureProductId — fluxo
  // staged: fotos vivem em memória até submit.
  assert.doesNotMatch(uploader, /onEnsureProductId/);
  assert.doesNotMatch(uploader, /createDraftProduct/);

  // Página /admin/produtos não tem mais o gate ?novo=1 nem ProductCreateGate.
  assert.doesNotMatch(productsPage, /href="\/admin\/produtos\?novo=1"/);
  assert.doesNotMatch(productsPage, /ProductCreateGate|ProductDialogGate/);
});

test("appearance preview can be embedded only by same-origin admin iframe", () => {
  const config = readFileSync("next.config.ts", "utf8");

  assert.match(config, /source: "\/admin\/aparencia\/preview\/:path\*"/);
  assert.match(config, /"frame-ancestors 'self'"/);
  assert.match(config, /key: "X-Frame-Options",\s*value: "SAMEORIGIN"/);
  assert.match(config, /source: "\/:path\*"/);
  assert.match(config, /headers: GLOBAL_SECURITY_HEADERS/);
  assert.match(config, /const GLOBAL_SECURITY_HEADERS = SECURITY_HEADERS/);
  assert.doesNotMatch(config, /SECURITY_HEADERS\.filter/);
});
