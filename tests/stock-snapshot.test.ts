import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadSource(): string {
  return readFileSync("src/actions/stock/load.ts", "utf8");
}

test("loadStockSnapshot filtra status pelo saldo efetivo, incluindo variantes rastreadas", () => {
  const s = loadSource();

  assert.match(s, /function effectiveStockSql/);
  assert.match(s, /function controlsStockSql/);
  assert.match(s, /SUM\(pv\.stock_quantity\)/);
  assert.match(s, /pv\.is_active = true/);
  assert.match(s, /pv\.track_stock = true/);
  assert.match(s, /conditions\.push\(controlsStock\)/);
  assert.match(s, /conditions\.push\(sql`\$\{effectiveStock\} > 0`\)/);
  assert.match(s, /conditions\.push\(sql`\$\{effectiveStock\} = 0`\)/);
  assert.match(s, /conditions\.push\(sql`NOT \$\{controlsStock\}`\)/);
});

test("loadStockSnapshotCounts usa a mesma regra de saldo efetivo dos filtros", () => {
  const s = loadSource();

  assert.match(
    s,
    /const trackedAndPositive = sql`\$\{controlsStock\} and \$\{effectiveStock\} > 0`;/,
  );
  assert.match(
    s,
    /const trackedAndZero = sql`\$\{controlsStock\} and \$\{effectiveStock\} = 0`;/,
  );
  assert.match(
    s,
    /const trackedAndLow = sql`\$\{controlsStock\} and \$\{productTable\.minStockQuantity\} is not null and \$\{effectiveStock\} > 0 and \$\{effectiveStock\} <= \$\{productTable\.minStockQuantity\}`;/,
  );
  assert.match(s, /const noTracking = sql`NOT \$\{controlsStock\}`;/);
});

test("linhas do snapshot mostram controle quando o estoque vive nas variantes", () => {
  const s = loadSource();

  assert.match(
    s,
    /const controlsStock = r\.trackStock \|\| trackedVariants\.length > 0;/,
  );
  assert.match(s, /trackStock: controlsStock,/);
});
