import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function src(path: string): string {
  return readFileSync(path, "utf8");
}

test("onboarding: identidade não bloqueia continuar por falha transitória do check de slug", () => {
  const identity = src("src/app/(auth)/criar-loja/identidade/page.tsx");

  assert.doesNotMatch(
    identity,
    /disabled=\{isPending \|\| !slugAvailable\}/,
    "Continuar não pode ficar morto só porque o preflight assíncrono do slug falhou",
  );
  assert.match(identity, /isValidSlugFormat\(/);
  assert.match(identity, /toast\.error\([^)]*salvar esta etapa/s);
});

test("onboarding: criação de loja respeita redirectTo da server action", () => {
  const tipo = src("src/app/(auth)/criar-loja/tipo-negocio/page.tsx");

  assert.match(tipo, /result\.redirectTo/);
  assert.doesNotMatch(
    tipo,
    /router\.push\(`\/criar-loja\/bem-vindo\?\$\{params\.toString\(\)\}`\)/,
    "client não deve ignorar redirectTo e forçar snapshot local",
  );
});

test("stock: produto create/update gera stock_movement initial/adjustment", () => {
  const create = src("src/actions/product/create-from-values.ts");
  const update = src("src/actions/product/update.ts");

  assert.match(create, /stockMovementTable/);
  assert.match(create, /movementType:\s*["']initial["']/);
  assert.match(update, /stockMovementTable/);
  assert.match(update, /movementType:\s*["']adjustment["']/);
  assert.match(update, /quantityDelta:\s*[^,]*delta/);
  assert.doesNotMatch(
    update,
    /\.delete\(productVariantTable\)/,
    "remover variante não pode apagar histórico stock_movement via ON DELETE CASCADE",
  );
});

test("stock: KPIs e busca incluem variantes sem prometer falso", () => {
  const load = src("src/actions/stock/load.ts");

  assert.match(load, /productVariantTable\.stockQuantity/);
  assert.match(load, /ilike\(productVariantTable\.name/);
  assert.doesNotMatch(load, /void sum;/);
  assert.doesNotMatch(load, /void or;/);
});

test("pdv: busca não retorna variante inativa", () => {
  const pdvSearch = src("src/actions/product/search-for-pdv.ts");

  assert.match(pdvSearch, /eq\(productVariantTable\.isActive, true\)/);
});

test("admin: remove controles fake e links quebrados visíveis", () => {
  const recent = src("src/components/admin/dashboard/recent-orders-table.tsx");
  const customers = src("src/components/admin/customers-table.tsx");
  const orders = src("src/components/admin/orders-table.tsx");
  const nav = src("src/components/admin/shell/nav-items.ts");

  assert.doesNotMatch(recent, /href=\{`\/admin\/pedidos\/\$\{o\.id\}`\}/);
  assert.doesNotMatch(customers, /type="checkbox"[\s\S]{0,220}disabled/);
  assert.doesNotMatch(orders, /type="checkbox"[\s\S]{0,220}disabled/);
  for (const immature of [
    "Grupos de clientes",
    "Contatos",
    "Cupons",
    "Relatórios",
    "Coleções",
    "Equipe",
    "Assinatura",
    "Suporte",
  ]) {
    assert.doesNotMatch(nav, new RegExp(`label: ["']${immature}["']`));
  }
});

test("pdv: venda concluída permanece no PDV e oferece impressão explícita", () => {
  const pdv = src("src/components/admin/pdv/pdv-shell.tsx");

  assert.doesNotMatch(pdv, /router\.push\(`\/admin\/pdv\/recibo\/\$\{result\.publicToken\}`\)/);
  assert.match(pdv, /lastSale/);
  assert.match(pdv, /Imprimir recibo/);
  assert.match(pdv, /Nova venda/);
});
