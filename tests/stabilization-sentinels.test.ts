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

// ---------------------------------------------------------------------
// Sprint 3 — clientes + caixa
// ---------------------------------------------------------------------

test("Sprint 3.1: searchCustomers retorna notes + matcha por documento normalizado", () => {
  const s = src("src/actions/customer/search.ts");
  // Trata documento (digits-only) via normalizeDocument quando query tem
  // 3+ dígitos. Sem isso, lojista que digita CPF não acha cliente.
  assert.match(
    s,
    /normalizeDocument\(/,
    "searchCustomers deve normalizar query pra digits e bater contra customer.document",
  );
  assert.match(
    s,
    /notes:\s*customerTable\.notes/,
    "searchCustomers deve incluir notes nos hits (pra badge do PDV)",
  );
  // Tipo precisa expor notes
  assert.match(
    s,
    /notes:\s*string\s*\|\s*null/,
    "CustomerSearchHit deve declarar notes: string | null",
  );
});

test("Sprint 3.2: PDV renderiza badge de anotação do cliente vinculado", () => {
  const pdv = src("src/components/admin/pdv/pdv-shell.tsx");
  assert.match(
    pdv,
    /customerNotes,\s*setCustomerNotes/,
    "PDV deve guardar customerNotes em state",
  );
  assert.match(
    pdv,
    /Anotação sobre este cliente/,
    "badge da anotação deve aparecer com label claro",
  );
  // onPick precisa setar notes do hit
  assert.match(
    pdv,
    /setCustomerNotes\(c\?\.notes\s*\?\?\s*null\)/,
    "onPick deve salvar c.notes no state",
  );
});

test("Sprint 3.3: histórico do cliente linka pro detalhe via ?detail={orderId}", () => {
  const f = src("src/app/(admin)/admin/clientes/[id]/edit-customer-form.tsx");
  assert.match(
    f,
    /href=\{`\/admin\/pedidos\?detail=\$\{o\.id\}`\}/,
    "edit-customer-form deve linkar pra /admin/pedidos?detail={orderId}",
  );
  // Não pode ressuscitar o link antigo via ?q=
  assert.doesNotMatch(
    f,
    /\/admin\/pedidos\?q=\$\{encodeURIComponent\(o\.shortCode\)\}/,
    "Link antigo via ?q= (Onda pré-2.12) não pode ressuscitar",
  );
});

test("Sprint 3.4: pedidos/page aceita fiado=pendente + EXISTS subquery", () => {
  const page = src("src/app/(admin)/admin/pedidos/page.tsx");
  assert.match(
    page,
    /fiado:\s*enumOrNull\(\["pendente"\]/,
    "pedidosSearchSchema deve aceitar fiado: 'pendente' | null",
  );
  assert.match(
    page,
    /fiadoFilter\s*===\s*"pendente"/,
    "page deve aplicar filtro quando fiadoFilter='pendente'",
  );
  assert.match(
    page,
    /EXISTS\s*\(\s*SELECT 1 FROM \$\{receivableTable\} r/,
    "filtro deve usar EXISTS subquery em receivable",
  );

  // UI toolbar tem o toggle
  const tb = src("src/components/admin/orders-toolbar.tsx");
  assert.match(
    tb,
    /Só fiado pendente/,
    "OrdersToolbar deve renderizar botão 'Só fiado pendente'",
  );
  assert.match(
    tb,
    /toggleFiadoPendente/,
    "OrdersToolbar deve expor handler toggleFiadoPendente",
  );
});

test("Sprint 3.5: store.requireOpenCashSession + PDV bloqueia + UI card", () => {
  const schema = src("src/db/schema/store.ts");
  // Tolera quebras de linha do Prettier entre os chains do Drizzle.
  assert.match(
    schema,
    /requireOpenCashSession:\s*boolean\("require_open_cash_session"\)\s*\.notNull\(\)\s*\.default\(false\)/s,
    "schema deve expor requireOpenCashSession NOT NULL DEFAULT false",
  );

  // PDV bloqueia quando setting ativo + sem caixa + mode != quote
  const pdv = src("src/actions/order/balcao/create-balcao-sale.ts");
  assert.match(
    pdv,
    /store\.requireOpenCashSession\s*&&\s*cashSessionIdForOrder\s*===\s*null\s*&&\s*data\.mode\s*!==\s*"quote"/,
    "create-balcao-sale deve bloquear venda quando setting ativo + sem caixa",
  );
  assert.match(
    pdv,
    /CASH_SESSION_REQUIRED/,
    "errorCode 'CASH_SESSION_REQUIRED' deve existir pro UI rotear",
  );

  // Action update-pdv-policy existe
  const action = src("src/actions/store/update-pdv-policy.ts");
  assert.match(
    action,
    /requireOpenCashSession:\s*data\.requireOpenCashSession/,
    "updatePdvPolicy deve setar require_open_cash_session no UPDATE",
  );

  // Card no /admin/configuracoes
  const config = src("src/app/(admin)/admin/configuracoes/page.tsx");
  assert.match(
    config,
    /<PdvPolicyCard/,
    "configuracoes/page deve renderizar <PdvPolicyCard/>",
  );
});

// ---------------------------------------------------------------------
// Sprint 4 — relatórios contador-grade + impressão
// ---------------------------------------------------------------------

test("Sprint 4.1: ReportLayout expõe `document` no storeInfo e renderiza CNPJ/CPF", () => {
  const layout = src("src/components/admin/report/report-layout.tsx");
  assert.match(
    layout,
    /document\?:\s*string\s*\|\s*null/,
    "ReportStoreInfo deve expor document?: string | null",
  );
  assert.match(
    layout,
    /CNPJ\/CPF:\s*\{storeInfo\.document\}/,
    "ReportLayout deve renderizar 'CNPJ/CPF: {document}' quando preenchido",
  );

  // Helper canônico retorna doc formatado (CPF/CNPJ pontuado)
  const info = src("src/actions/reports/store-info.ts");
  assert.match(
    info,
    /document:\s*formatDocument\(store\.document\)/,
    "loadStoreInfoForReport deve formatar e devolver document",
  );
});

test("Sprint 4.2: load-sales aceita categoryIds/brandIds e gera EXISTS", () => {
  const ls = src("src/actions/reports/load-sales.ts");
  assert.match(
    ls,
    /parseUuidCsv/,
    "load-sales deve ter helper parseUuidCsv (sanitização de IDs)",
  );
  assert.match(
    ls,
    /EXISTS\s*\(\s*SELECT 1 FROM \$\{orderItemTable\}/,
    "load-sales deve filtrar via EXISTS quando há category/brand",
  );

  // Loader de opções existe
  const fo = src("src/actions/reports/filter-options.ts");
  assert.match(fo, /categories:\s*ReportFilterOption\[\]/);
  assert.match(fo, /brands:\s*ReportFilterOption\[\]/);
});

test("Sprint 4.3: sales-report-client renderiza GroupedSalesReport quando groupBy=day", () => {
  const c = src("src/components/admin/sales-report-client.tsx");
  assert.match(
    c,
    /groupByDay\s*=\s*filters\.groupBy === "day"/,
    "client deve derivar groupByDay de filters.groupBy",
  );
  assert.match(
    c,
    /function GroupedSalesReport/,
    "client deve definir GroupedSalesReport pra view agrupada",
  );
});

test("Sprint 4.4: receivables-report-client expõe buckets de aging + cards", () => {
  const c = src("src/components/admin/receivables-report-client.tsx");
  assert.match(
    c,
    /type AgingBucket\s*=\s*"current"\s*\|\s*"1-30"\s*\|\s*"31-60"\s*\|\s*"61\+"/,
    "AgingBucket type deve cobrir current/1-30/31-60/61+",
  );
  assert.match(
    c,
    /bucketFromDays/,
    "função bucketFromDays deve existir pra classificar por dias",
  );
  assert.match(
    c,
    /agingTotals\s*:\s*Record<AgingBucket, number>/,
    "agingTotals deve agregar por bucket",
  );
});

test("Sprint 4.5: critério de custeio aparece no rodapé margem", () => {
  const c = src("src/components/admin/margin-report-client.tsx");
  assert.match(
    c,
    /snapshot histórico, não FIFO ou custo médio/,
    "rodapé do relatório de margem deve explicar critério de custeio",
  );
});

test("Sprint 4.6: recibo PDV aceita ?fmt=a4|thermal", () => {
  const r = src("src/app/(admin)/admin/pdv/recibo/[token]/page.tsx");
  assert.match(
    r,
    /type ReceiptFmt\s*=\s*"thermal"\s*\|\s*"a4"/,
    "página de recibo deve declarar union ReceiptFmt",
  );
  // Default thermal preserva fluxo atual
  assert.match(
    r,
    /rawFmt === "a4"\s*\?\s*"a4"\s*:\s*"thermal"/,
    "fmt deve fazer default em 'thermal' (preserva impressora térmica)",
  );
  assert.match(
    r,
    /\?fmt=thermal/,
    "UI deve oferecer toggle pra thermal",
  );
  assert.match(
    r,
    /\?fmt=a4/,
    "UI deve oferecer toggle pra a4",
  );
});

test("Sprint 4.7: Z de caixa tem linha de assinatura + rodapé universal", () => {
  const z = src("src/app/(admin)/admin/pdv/caixa/[id]/page.tsx");
  assert.match(z, /Conferido por/);
  assert.match(z, /Gerado em/);
  // Rodapé só na impressão
  assert.match(
    z,
    /report-page-marker/,
    "Z deve incluir contador de página (CSS counter)",
  );
});

test("Sprint 4.8: ReportLayout aceita operatorName + helper loadReportOperatorName", () => {
  const layout = src("src/components/admin/report/report-layout.tsx");
  assert.match(layout, /operatorName\?:\s*string\s*\|\s*null/);
  assert.match(
    layout,
    /operatorName\s*\?\s*` por \$\{operatorName\}`/,
    "rodapé deve concatenar 'por {operador}' quando preenchido",
  );

  const info = src("src/actions/reports/store-info.ts");
  assert.match(
    info,
    /export async function loadReportOperatorName/,
    "helper loadReportOperatorName deve existir",
  );

  // Marker CSS + globals.css
  const css = src("src/app/globals.css");
  assert.match(
    css,
    /\.report-page-marker::after\s*\{\s*content:\s*counter\(page\)/,
    "globals.css deve ter regra ::after counter(page) pra contador de página",
  );
});

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
