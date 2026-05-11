/**
 * Static-analysis tests for `src/lib/order/restock.ts` — verifica invariantes
 * estruturais do helper de reposição de estoque (espelho de
 * `create-from-cart.ts:336-383`, mas no sentido inverso).
 *
 * O helper é chamado de duas trilhas:
 *   1. `update-status.ts` (cancelamento manual via UI admin)
 *   2. `app/api/cron/expire-orders/route.ts` (expiração automática)
 *
 * Cenários cobertos:
 *   1. Produto sem variante, com track_stock     → produto recebe `+= qty`
 *   2. Variante com track_stock                  → variante recebe `+= qty`,
 *                                                   produto NÃO é tocado
 *   3. Produto e variante sem track_stock        → nenhum UPDATE rodado
 *   4. Multi-item                                → cada item repõe na entidade
 *                                                   correta (variant-first)
 *   5. storeId errado / cross-tenant             → WHERE filtra storeId,
 *                                                   defesa em profundidade
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadRestockSource(): string {
  return readFileSync("src/lib/order/restock.ts", "utf8");
}

test("restockOrderItems exporta a assinatura esperada (tx, orderId, storeId)", () => {
  const restockSource = loadRestockSource();
  // Helper recebe a transação do caller — NÃO abre transação própria.
  // Caller controla atomicidade com o UPDATE de status.
  assert.match(
    restockSource,
    /export\s+async\s+function\s+restockOrderItems\s*\(/,
  );
  assert.match(restockSource, /\borderId:\s*string\b/);
  assert.match(restockSource, /\bstoreId:\s*string\b/);
  assert.match(restockSource, /\btx:\s*Tx\b/);
});

test("restockOrderItems não abre transação própria — caller controla atomicidade", () => {
  const restockSource = loadRestockSource();
  // Antipattern: chamar `tx.transaction(...)` ou `db.transaction(...)` aqui
  // quebra a atomicidade com o UPDATE de status no caller.
  assert.doesNotMatch(restockSource, /tx\.transaction\s*\(/);
  assert.doesNotMatch(restockSource, /\bdb\.transaction\s*\(/);
});

test("restockOrderItems carrega orderItems pelo orderId em escopo de tenant", () => {
  const restockSource = loadRestockSource();
  // Lê itens do pedido — o JOIN/escopo precisa cruzar storeId pra cobrir
  // storeId errado (cenário 5) com defesa em profundidade.
  assert.match(restockSource, /orderItemTable/);
  assert.match(restockSource, /eq\(orderItemTable\.orderId,\s*orderId\)/);
});

test("restockOrderItems aplica variant-first com fallback produto (cenários 1+2+4)", () => {
  const restockSource = loadRestockSource();
  // Lógica espelha decremento em create-from-cart.ts: variant.trackStock
  // vence; senão produto.trackStock; senão no-op (cenário 3).
  assert.match(restockSource, /shouldRestockVariant/);
  assert.match(restockSource, /shouldRestockProduct/);
  assert.match(restockSource, /trackStock/);
});

test("restockOrderItems incrementa estoque (sentido inverso do decremento)", () => {
  const restockSource = loadRestockSource();
  // Decremento usa `- ${ci.quantity}`. Reposição usa `+ ${item.quantity}`.
  // Ambas via expressão SQL (não read-modify-write em JS) pra evitar race.
  assert.match(
    restockSource,
    /productVariantTable\.stockQuantity\}\s*\+\s*\$\{/,
  );
  assert.match(restockSource, /productTable\.stockQuantity\}\s*\+\s*\$\{/);
  // Nada de subtração inadvertida — sanidade contra typo.
  assert.doesNotMatch(
    restockSource,
    /stockQuantity\}\s*-\s*\$\{[^}]+\.quantity/,
  );
});

test("restockOrderItems filtra por storeId em todos os UPDATEs (cenário 5)", () => {
  const restockSource = loadRestockSource();
  // Defesa em profundidade — RLS já protege via GUC `app.current_store_id`,
  // mas double-check no WHERE evita estoque "vazar" em caso de bug no caller
  // (ex: passar storeId errado por engano).
  assert.match(
    restockSource,
    /eq\(productVariantTable\.storeId,\s*storeId\)/,
  );
  assert.match(restockSource, /eq\(productTable\.storeId,\s*storeId\)/);
});

test("restockOrderItems NÃO usa optimistic lock no estoque atual", () => {
  const restockSource = loadRestockSource();
  // Diferente do decremento (que usa `gte(stockQuantity, qty)` pra evitar
  // overshoot negativo), reposição pode ultrapassar o valor original — o
  // lojista pode ter aumentado capacidade depois. Não filtrar por gte.
  assert.doesNotMatch(restockSource, /gte\(productVariantTable\.stockQuantity/);
  assert.doesNotMatch(restockSource, /gte\(productTable\.stockQuantity/);
});

test("restockOrderItems loga quando reposição parcial (variant deletada — caso raro)", () => {
  const restockSource = loadRestockSource();
  // Se variantId no orderItem aponta pra variant deletada, o UPDATE retorna
  // 0 rows. Logar pra investigação posterior — não falhar (cenário raro mas
  // possível com soft-delete eventual). Bloco 2.2 migrou console.warn →
  // logger.warn estruturado com eventos namespaced.
  assert.match(restockSource, /logger\.warn/);
  assert.match(restockSource, /restock\.partial_miss_variant/);
  assert.match(restockSource, /restock\.partial_miss_product/);
});

test("restockOrderItems usa tipos rigorosos (Tx + sem any)", () => {
  const restockSource = loadRestockSource();
  // Tx vem de @/lib/tenant — single source of truth pro tipo da transação.
  assert.match(restockSource, /from\s+["']@\/lib\/tenant["']/);
  assert.match(restockSource, /\btype\s+Tx\b|import\s+type\s*\{[^}]*\bTx\b/);
  // Não toleramos `any` solto.
  assert.doesNotMatch(restockSource, /:\s*any\b/);
});

// ---------------------------------------------------------------------
// updateOrderStatus — integração com restock
// ---------------------------------------------------------------------

function loadUpdateStatusSource(): string {
  return readFileSync("src/actions/order/update-status.ts", "utf8");
}

test("updateOrderStatus importa e dispara restockOrderItems", () => {
  const source = loadUpdateStatusSource();
  assert.match(source, /import\s*\{\s*restockOrderItems\s*\}\s*from\s*["']@\/lib\/order\/restock["']/);
  assert.match(source, /await\s+restockOrderItems\(\s*tx\s*,/);
});

test("updateOrderStatus repõe estoque em awaiting_whatsapp → canceled", () => {
  const source = loadUpdateStatusSource();
  // Cancelamento manual de pedido aguardando whatsapp: cliente nem confirmou,
  // estoque deve voltar pra loja.
  assert.match(source, /awaiting_whatsapp[\s\S]{0,80}canceled/);
});

test("updateOrderStatus repõe estoque em confirmed → canceled", () => {
  const source = loadUpdateStatusSource();
  // Cancelamento de pedido já confirmado mas não fulfilled: cliente desistiu,
  // produto não saiu da loja, estoque deve voltar.
  assert.match(source, /confirmed[\s\S]{0,80}canceled/);
});

test("updateOrderStatus repõe estoque em awaiting_whatsapp → expired", () => {
  const source = loadUpdateStatusSource();
  // Se lojista forçar expired manualmente (cron faz isso automaticamente em
  // outra trilha), repor.
  assert.match(source, /awaiting_whatsapp[\s\S]{0,80}expired/);
});

test("updateOrderStatus faz UPDATE com optimistic lock ANTES do restock (gate C1)", () => {
  const source = loadUpdateStatusSource();
  // Gate C1 da auditoria 2026-05-11: UPDATE primeiro com `status = order.status`
  // no WHERE + .returning() — se updated.length === 0, outro processo (cron
  // expire-orders ou outra aba) já mudou status, NÃO repõe estoque. Sem isso,
  // lojista clicando "Cancelar" 2× = double-restock = estoque infla silencioso.
  const updateStatusIdx = source.indexOf("update(orderTable)");
  const restockIdx = source.indexOf("restockOrderItems(tx");
  assert.ok(
    updateStatusIdx > 0 && restockIdx > 0,
    "esperava update(orderTable) e restockOrderItems(tx, ...) presentes",
  );
  assert.ok(
    updateStatusIdx < restockIdx,
    "UPDATE com optimistic lock deve vir ANTES do restock (gate C1)",
  );
  // Confere optimistic lock real: WHERE inclui status atual + .returning()
  // pra checar affectedRows. Sem isso, race fica aberto.
  assert.match(
    source,
    /eq\(orderTable\.status,\s*order\.status\)/,
    "WHERE do UPDATE deve incluir eq(orderTable.status, order.status) — optimistic lock",
  );
  assert.match(
    source,
    /\.returning\(\s*\{\s*id:\s*orderTable\.id\s*\}\s*\)/,
    "UPDATE deve usar .returning() pra detectar 0-row update (race perdido)",
  );
  assert.match(
    source,
    /updated\.length\s*===\s*0/,
    "deve checar updated.length === 0 antes de repor estoque",
  );
});

test("updateOrderStatus mantém revalidateTag após cancel/expire", () => {
  const source = loadUpdateStatusSource();
  // Convenção #4 do CLAUDE.md — mutação que afeta catálogo público
  // (estoque) precisa invalidar cache.
  assert.match(source, /revalidateTag\(`store-\$\{store\.slug\}`\)/);
});
