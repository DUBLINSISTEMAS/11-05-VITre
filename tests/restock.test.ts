/**
 * Static-analysis tests for `src/lib/order/restock.ts` — verifica invariantes
 * estruturais do helper de reposição de estoque.
 *
 * REFACTOR Fase 4 (ADR-0015): o helper passou de `UPDATE stockQuantity +=`
 * direto pra INSERT em `stock_movement` do tipo `return`. Trigger SQL
 * `sync_stock_cache_on_movement` atualiza o cache automaticamente.
 *
 * Helper chamado de duas trilhas:
 *   1. `update-status.ts` (cancelamento manual via UI admin)
 *   2. `app/api/cron/expire-orders/route.ts` (expiração automática)
 *
 * Cenários cobertos:
 *   1. Produto sem variante, com track_stock     → INSERT movement no produto
 *   2. Variante com track_stock                  → INSERT movement com variantId
 *   3. Produto e variante sem track_stock        → no-op (sem INSERT)
 *   4. storeId presente em todos os movements    → defesa em profundidade vs RLS
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadRestockSource(): string {
  return readFileSync("src/lib/order/restock.ts", "utf8");
}

test("restockOrderItems exporta a assinatura esperada (tx, orderId, storeId)", () => {
  const restockSource = loadRestockSource();
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
  assert.doesNotMatch(restockSource, /tx\.transaction\s*\(/);
  assert.doesNotMatch(restockSource, /\bdb\.transaction\s*\(/);
});

test("restockOrderItems carrega orderItems pelo orderId em escopo de tenant", () => {
  const restockSource = loadRestockSource();
  assert.match(restockSource, /orderItemTable/);
  assert.match(restockSource, /eq\(orderItemTable\.orderId,\s*orderId\)/);
});

test("restockOrderItems INSERT em stock_movement (Fase 4 — ADR-0015)", () => {
  const restockSource = loadRestockSource();
  // Append-only: helper insere movement do tipo `return` com delta POSITIVO.
  // Trigger SQL atualiza o cache stock_quantity em product/variant.
  assert.match(restockSource, /stockMovementTable/);
  assert.match(restockSource, /tx\.insert\(stockMovementTable\)/);
  assert.match(restockSource, /movementType:\s*["']return["']/);
  assert.match(restockSource, /referenceType:\s*["']order["']/);
});

test("restockOrderItems NÃO usa mais UPDATE direto em product/variant", () => {
  const restockSource = loadRestockSource();
  // Pré-Fase 4 o helper fazia `UPDATE stockQuantity = stockQuantity + qty`
  // direto. Agora a fonte de verdade é o stock_movement; cache é via trigger.
  assert.doesNotMatch(
    restockSource,
    /tx\.update\(productVariantTable\)[\s\S]*\.set\(/,
  );
  assert.doesNotMatch(
    restockSource,
    /tx\.update\(productTable\)[\s\S]*\.set\(/,
  );
});

test("restockOrderItems decide variant-first com fallback produto", () => {
  const restockSource = loadRestockSource();
  // Lógica espelha decremento em create-from-cart.ts: variant.trackStock
  // vence; senão produto.trackStock; senão no-op.
  assert.match(restockSource, /variant\?\.trackStock/);
  assert.match(restockSource, /product\?\.trackStock/);
});

test("restockOrderItems movement carrega storeId (defesa em profundidade vs RLS)", () => {
  const restockSource = loadRestockSource();
  // RLS protege via GUC, mas storeId explícito no INSERT garante que a
  // policy passe + audit trace correto.
  assert.match(restockSource, /storeId,/);
});

test("restockOrderItems quantityDelta positivo (sentido inverso da venda)", () => {
  const restockSource = loadRestockSource();
  // Venda = delta negativo. Return/restock = delta positivo (devolve estoque).
  assert.match(restockSource, /quantityDelta:\s*item\.quantity/);
  // Sanidade: não pode ter delta com sinal negativo no return
  assert.doesNotMatch(restockSource, /quantityDelta:\s*-/);
});

test("restockOrderItems loga falha de INSERT (variant deletada — caso raro)", () => {
  const restockSource = loadRestockSource();
  // FK pode ficar inválida se variant deletada entre carregamento e INSERT.
  // Log estruturado, NÃO bloqueia cancelamento do pedido.
  assert.match(restockSource, /logger\.warn/);
  assert.match(restockSource, /restock\.movement_insert_failed/);
});

test("restockOrderItems usa tipos rigorosos (Tx + sem any)", () => {
  const restockSource = loadRestockSource();
  assert.match(restockSource, /from\s+["']@\/lib\/tenant["']/);
  assert.match(restockSource, /\btype\s+Tx\b|import\s+type\s*\{[^}]*\bTx\b/);
  assert.doesNotMatch(restockSource, /:\s*any\b/);
});

// ---------------------------------------------------------------------
// updateOrderStatus — integração com restock (não mudou pós-Fase 4)
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
  assert.match(source, /awaiting_whatsapp[\s\S]{0,80}canceled/);
});

test("updateOrderStatus repõe estoque em confirmed → canceled", () => {
  const source = loadUpdateStatusSource();
  assert.match(source, /confirmed[\s\S]{0,80}canceled/);
});

test("updateOrderStatus repõe estoque em awaiting_whatsapp → expired", () => {
  const source = loadUpdateStatusSource();
  assert.match(source, /awaiting_whatsapp[\s\S]{0,80}expired/);
});

test("updateOrderStatus faz UPDATE com optimistic lock ANTES do restock (gate C1)", () => {
  const source = loadUpdateStatusSource();
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
  assert.match(
    source,
    /eq\(orderTable\.status,\s*order\.status\)/,
    "WHERE do UPDATE deve incluir eq(orderTable.status, order.status)",
  );
  assert.match(
    source,
    /\.returning\(\s*\{\s*id:\s*orderTable\.id\s*\}\s*\)/,
    "UPDATE deve usar .returning() pra detectar 0-row update",
  );
  assert.match(
    source,
    /updated\.length\s*===\s*0/,
    "deve checar updated.length === 0 antes de repor estoque",
  );
});

test("updateOrderStatus mantém revalidateTag após cancel/expire", () => {
  const source = loadUpdateStatusSource();
  assert.match(source, /revalidateTag\(`store-\$\{store\.slug\}`\)/);
});
