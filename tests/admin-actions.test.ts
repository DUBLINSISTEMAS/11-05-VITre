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

