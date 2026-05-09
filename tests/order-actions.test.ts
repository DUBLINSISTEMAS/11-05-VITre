import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("createOrderFromCart revalidates the public storefront cache on success", () => {
  const action = readFileSync(
    "src/actions/order/create-from-cart.ts",
    "utf8",
  );

  // Importa revalidateTag de next/cache.
  assert.match(action, /from "next\/cache"/);
  assert.match(action, /\brevalidateTag\b/);

  // Convenção #4 do CLAUDE.md: o tag tem que ser exatamente
  // `store-${store.slug}` (mesmo usado pelos loaders do storefront).
  assert.match(action, /revalidateTag\(`store-\$\{store\.slug\}`\)/);

  // Sanidade: o revalidate fica antes do return final do happy path,
  // não num caminho de erro.
  const happyPathFragment = action.slice(action.indexOf("// 10. Mensagem"));
  assert.ok(
    happyPathFragment.includes("revalidateTag(`store-${store.slug}`)"),
    "revalidateTag deveria estar no happy path final, não num caminho de erro",
  );
});

test("updateOrderStatus revalidates the public storefront cache", () => {
  const action = readFileSync(
    "src/actions/order/update-status.ts",
    "utf8",
  );

  assert.match(action, /revalidatePath, revalidateTag/);
  assert.match(action, /revalidateTag\(`store-\$\{store\.slug\}`\)/);
});
