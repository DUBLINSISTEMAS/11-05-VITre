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
  // Onda 1.1 (2026-05-21): update agora decide entre 'initial' (false→true)
  // e 'adjustment' (continua true) em runtime via variável tipada — antes
  // era literal hardcoded "adjustment".
  assert.match(
    update,
    /movementType:\s*(?:productStockMovementType|variantMovementType|["'](?:initial|adjustment)["'])/,
  );
  // Ainda exigimos a presença das duas strings literais como source-of-truth
  // dos tipos possíveis no fluxo (defesa contra someone renomear sem
  // atualizar a semântica).
  assert.match(update, /["']initial["']/);
  assert.match(update, /["']adjustment["']/);
  assert.match(update, /quantityDelta:\s*[^,]*[Dd]elta/);
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
  // Sentinela original (Sprint 0): protegia contra checkboxes fake, links
  // de detalhe quebrados, e itens de sidebar com features vazias.
  //
  // Atualização Sprint 5: a lista de itens "imaturos" da sidebar virou
  // obsoleta — Sprints 1A/2/3/4/5 implementaram tudo (Relatórios, Cupons,
  // Grupos de cliente, Equipe, Assinatura etc.) e vocabulário canônico
  // passou nos labels. Só restam as 3 asserts de fake-controls que ainda
  // têm valor preventivo contra regressão.
  const recent = src("src/components/admin/dashboard/recent-orders-table.tsx");
  const customers = src("src/components/admin/customers-table.tsx");
  const orders = src("src/components/admin/orders-table.tsx");

  assert.doesNotMatch(recent, /href=\{`\/admin\/pedidos\/\$\{o\.id\}`\}/);
  assert.doesNotMatch(customers, /type="checkbox"[\s\S]{0,220}disabled/);
  assert.doesNotMatch(orders, /type="checkbox"[\s\S]{0,220}disabled/);
});

test("pdv: venda concluída permanece no PDV e oferece impressão explícita", () => {
  const pdv = src("src/components/admin/pdv/pdv-shell.tsx");

  assert.doesNotMatch(pdv, /router\.push\(`\/admin\/pdv\/recibo\/\$\{result\.publicToken\}`\)/);
  assert.match(pdv, /lastSale/);
  // Redesign 2026-05-21 encurtou o label do botão pra "Imprimir" pra
  // caber na coluna 380px. A intenção (oferecer impressão) é preservada.
  assert.match(pdv, /Imprimir/);
  assert.match(pdv, /Nova venda/);
});

// ---------------------------------------------------------------------
// Sprint 1.3 — KPI dashboard usa COUNTABLE_STATUSES (não <> canceled OR
// <> expired). Sem essa sentinela, alguém pode "abrir" o filtro do
// dashboard de novo e o drift KPI ≠ relatório volta sem aviso.
// ---------------------------------------------------------------------

test("reports/load.ts (KPI dashboard) usa COUNTABLE_STATUSES (não filtro inclusivo)", () => {
  const load = src("src/actions/reports/load.ts");

  // Importa da fonte única
  assert.match(
    load,
    /from\s+["']@\/actions\/order\/constants["']/,
    "load.ts deve importar de @/actions/order/constants",
  );
  assert.match(
    load,
    /inArray\(orderTable\.status,\s*COUNTABLE_STATUSES\)/,
    "load.ts deve usar inArray(status, COUNTABLE_STATUSES) no periodCond",
  );

  // Filtro antigo inclusivo (que incluía quote/awaiting_whatsapp/returned
  // no faturamento) NÃO pode ressurgir.
  assert.doesNotMatch(
    load,
    /status\}\s*<>\s*['"]canceled['"]/,
    "Drift KPI≠relatório: filtro `status <> canceled` foi removido pra usar COUNTABLE_STATUSES",
  );
  assert.doesNotMatch(
    load,
    /status\}\s*<>\s*['"]expired['"]/,
    "Drift KPI≠relatório: filtro `status <> expired` foi removido pra usar COUNTABLE_STATUSES",
  );
});

test("reports/load-sales|top|margin|dre importam COUNTABLE_STATUSES de constants", () => {
  for (const file of [
    "src/actions/reports/load-sales.ts",
    "src/actions/reports/load-top.ts",
    "src/actions/reports/load-margin.ts",
    "src/actions/reports/load-dre.ts",
  ]) {
    const s = src(file);
    assert.match(
      s,
      /import\s+\{[^}]*COUNTABLE_STATUSES[^}]*\}\s+from\s+["']@\/actions\/order\/constants["']/,
      `${file} deve importar COUNTABLE_STATUSES de @/actions/order/constants`,
    );
    // E não declarar mais inline (que era o padrão pré-Sprint-1.3).
    assert.doesNotMatch(
      s,
      /const\s+COUNTABLE_STATUSES\s*:/,
      `${file} não pode redeclarar COUNTABLE_STATUSES local — usar import`,
    );
  }
});

// ---------------------------------------------------------------------
// Sprint 1.4 — devolução desconta em todos os 4 loaders de relatório.
// Sem essas sentinelas, alguém pode refatorar e regredir pro caso
// "faturamento mente" (devolução não desconta).
// ---------------------------------------------------------------------

test("reports/load-sales|top|margin|dre fazem JOIN com orderReturnItemTable", () => {
  for (const file of [
    "src/actions/reports/load-sales.ts",
    "src/actions/reports/load-top.ts",
    "src/actions/reports/load-margin.ts",
    "src/actions/reports/load-dre.ts",
  ]) {
    const s = src(file);
    assert.match(
      s,
      /orderReturnItemTable/,
      `${file} deve importar orderReturnItemTable pra subtrair devoluções`,
    );
    assert.match(
      s,
      /quantityReturned/,
      `${file} deve agregar order_return_item.quantity_returned`,
    );
  }
});

test("DRE expõe returnedRevenueInCents + returnedCogsInCents", () => {
  const types = src("src/actions/reports/types.ts");
  assert.match(
    types,
    /returnedRevenueInCents:\s*number/,
    "DreSimpleSummary deve incluir returnedRevenueInCents",
  );
  assert.match(
    types,
    /returnedCogsInCents:\s*number/,
    "DreSimpleSummary deve incluir returnedCogsInCents",
  );

  // UI da DRE precisa exibir a linha de devoluções (regressão fácil de
  // perder se alguém esconder a linha "se zero").
  const dre = src("src/components/admin/dre-report-client.tsx");
  assert.match(
    dre,
    /Devoluções \(vendas que voltaram\)/,
    "dre-report-client deve renderizar linha de devoluções",
  );
});

// ---------------------------------------------------------------------
// Sprint 2.3 — frete (shipping_in_cents) sai da receita no DRE.
// ---------------------------------------------------------------------

test("Sprint 2.3: order.shippingInCents existe no schema e é populado pelo DRE", () => {
  const orderSchema = src("src/db/schema/order.ts");
  assert.match(
    orderSchema,
    /shippingInCents:\s*integer\("shipping_in_cents"\)\.notNull\(\)\.default\(0\)/,
    "order schema deve declarar shippingInCents NOT NULL DEFAULT 0",
  );

  const dre = src("src/actions/reports/load-dre.ts");
  assert.match(
    dre,
    /shipping:\s*sql<number>`coalesce\(sum\(\${orderTable\.shippingInCents}\)/,
    "load-dre deve agregar shipping no orderAgg",
  );
  // netRevenue precisa subtrair shipping (repasse, não receita)
  assert.match(
    dre,
    /netRevenue\s*=\s*\([^)]*netRevenue[^)]*\)\s*-\s*shipping\s*-\s*returnedRevenue/,
    "netRevenue deve subtrair shipping (repasse pra transportadora)",
  );

  const types = src("src/actions/reports/types.ts");
  assert.match(
    types,
    /shippingInCents:\s*number/,
    "DreSimpleSummary deve incluir shippingInCents",
  );

  // UI mostra linha de repasse
  const dreUi = src("src/components/admin/dre-report-client.tsx");
  assert.match(
    dreUi,
    /Repasses \(frete cobrado do cliente\)/,
    "dre-report-client deve renderizar linha de repasses (frete)",
  );
  // E o label antigo "Acréscimos (taxas, frete, embalagem)" não pode
  // ressurgir (frete saiu daqui)
  assert.doesNotMatch(
    dreUi,
    /Acréscimos \(taxas, frete, embalagem\)/,
    "Label antigo que dizia frete dentro de Acréscimos não pode voltar",
  );
});
