#!/usr/bin/env node
/**
 * scripts/diagnose-stock.mjs — Onda 1.4 (2026-05-24)
 *
 * Diagnóstico de drift entre o CACHE (`product.stock_quantity` /
 * `product_variant.stock_quantity`) e a FONTE DA VERDADE (soma de
 * `stock_movement.quantity_delta`).
 *
 * Objetivo: identificar produtos onde o lojista editou estoque, o action
 * inseriu movement, mas o cache não foi atualizado pelo trigger (ou foi
 * atualizado errado). Output é uma tabela legível com linhas marcadas
 * "DRIFT" quando há divergência.
 *
 * USO:
 *   node --env-file=.env.local scripts/diagnose-stock.mjs
 *
 * Sem efeito colateral — apenas leitura.
 */

import pg from "pg";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL ou DATABASE_URL precisa estar setado em .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log("=== DIAGNÓSTICO DE ESTOQUE (drift cache vs movements) ===\n");

// 1) Stats globais.
const overview = await client.query(`
  SELECT
    (SELECT count(*) FROM "product") AS total_products,
    (SELECT count(*) FROM "product" WHERE track_stock = true) AS tracked,
    (SELECT count(*) FROM "product_variant" WHERE track_stock = true) AS tracked_variants,
    (SELECT count(*) FROM "stock_movement") AS total_movements
`);
const o = overview.rows[0];
console.log(
  `Produtos: ${o.total_products}  ·  Rastreados: ${o.tracked}  ·  Variantes rastreadas: ${o.tracked_variants}  ·  Movements: ${o.total_movements}\n`,
);

// 2) Drift por produto (sem variantes).
const productDrift = await client.query(`
  SELECT
    p.id,
    p.name,
    p.slug,
    p.track_stock,
    p.stock_quantity AS cache,
    COALESCE(
      (
        SELECT SUM(sm.quantity_delta)
        FROM "stock_movement" sm
        WHERE sm.product_id = p.id
          AND sm.variant_id IS NULL
      ),
      0
    )::int AS movements_sum,
    (
      SELECT count(*)
      FROM "product_variant" pv
      WHERE pv.product_id = p.id AND pv.track_stock = true
    )::int AS tracked_variant_count
  FROM "product" p
  WHERE p.track_stock = true
  ORDER BY p.created_at DESC
  LIMIT 50
`);

console.log("--- PRODUTOS RASTREADOS (último 50, mais recentes primeiro) ---");
console.log("NOME (32) | CACHE | MOVEMENTS | VAR_TRACK | DRIFT");
console.log("-".repeat(80));
let driftCount = 0;
for (const r of productDrift.rows) {
  const cache = r.cache ?? 0;
  const moves = r.movements_sum ?? 0;
  const hasTrackedVariants = r.tracked_variant_count > 0;
  // Se tem variantes rastreadas, o cache do produto-base é "sem uso"
  // (estoque vive nas variantes). Sinalizar de outro jeito.
  const drift =
    !hasTrackedVariants && cache !== moves ? `⚠️ DRIFT (${cache} vs ${moves})` : "";
  if (drift) driftCount += 1;
  const variantsLabel = hasTrackedVariants
    ? `(${r.tracked_variant_count} variantes)`
    : "";
  const name = (r.name || "(sem nome)").slice(0, 32).padEnd(32, " ");
  console.log(
    `${name} | ${String(cache).padStart(5)} | ${String(moves).padStart(9)} | ${variantsLabel.padEnd(15)} | ${drift}`,
  );
}
console.log("");

// 3) Drift por variante.
const variantDrift = await client.query(`
  SELECT
    pv.id AS variant_id,
    p.name AS product_name,
    pv.name AS variant_name,
    pv.stock_quantity AS cache,
    COALESCE(
      (
        SELECT SUM(sm.quantity_delta)
        FROM "stock_movement" sm
        WHERE sm.variant_id = pv.id
      ),
      0
    )::int AS movements_sum
  FROM "product_variant" pv
  INNER JOIN "product" p ON p.id = pv.product_id
  WHERE pv.track_stock = true AND pv.is_active = true
  ORDER BY pv.created_at DESC
  LIMIT 50
`);

if (variantDrift.rows.length > 0) {
  console.log("--- VARIANTES RASTREADAS (último 50) ---");
  console.log("PRODUTO + VARIANTE (40) | CACHE | MOVEMENTS | DRIFT");
  console.log("-".repeat(80));
  for (const r of variantDrift.rows) {
    const cache = r.cache ?? 0;
    const moves = r.movements_sum ?? 0;
    const drift =
      cache !== moves ? `⚠️ DRIFT (${cache} vs ${moves})` : "";
    if (drift) driftCount += 1;
    const label =
      `${r.product_name} · ${r.variant_name}`.slice(0, 40).padEnd(40, " ");
    console.log(
      `${label} | ${String(cache).padStart(5)} | ${String(moves).padStart(9)} | ${drift}`,
    );
  }
  console.log("");
}

// 4) Produtos sem tracking que foram alvo de stock_movement (vetor de bug).
const orphanMovements = await client.query(`
  SELECT
    p.id,
    p.name,
    p.track_stock,
    p.stock_quantity AS cache,
    count(sm.id)::int AS movement_count,
    COALESCE(SUM(sm.quantity_delta), 0)::int AS movements_sum
  FROM "product" p
  INNER JOIN "stock_movement" sm ON sm.product_id = p.id AND sm.variant_id IS NULL
  WHERE p.track_stock = false
  GROUP BY p.id, p.name, p.track_stock, p.stock_quantity
  ORDER BY count(sm.id) DESC
  LIMIT 20
`);

if (orphanMovements.rows.length > 0) {
  console.log("--- PRODUTOS SEM TRACKING MAS COM MOVEMENTS (lojista mudou trackStock?) ---");
  console.log("NOME (40) | CACHE | MOVEMENTS_COUNT | MOVEMENTS_SUM");
  console.log("-".repeat(80));
  for (const r of orphanMovements.rows) {
    const cache = r.cache === null ? "null" : String(r.cache);
    const name = (r.name || "(sem nome)").slice(0, 40).padEnd(40, " ");
    console.log(
      `${name} | ${cache.padStart(5)} | ${String(r.movement_count).padStart(15)} | ${String(r.movements_sum).padStart(13)}`,
    );
  }
  console.log("");
}

// 5) Últimos 10 movements (forense de qual ação criou o quê).
const recentMovements = await client.query(`
  SELECT
    sm.id,
    sm.created_at,
    sm.movement_type,
    sm.quantity_delta,
    sm.reference_type,
    sm.notes,
    p.name AS product_name,
    pv.name AS variant_name
  FROM "stock_movement" sm
  LEFT JOIN "product" p ON p.id = sm.product_id
  LEFT JOIN "product_variant" pv ON pv.id = sm.variant_id
  ORDER BY sm.created_at DESC
  LIMIT 10
`);
console.log("--- ÚLTIMOS 10 MOVEMENTS (mais recentes primeiro) ---");
for (const r of recentMovements.rows) {
  const target = r.variant_name
    ? `${r.product_name} · ${r.variant_name}`
    : r.product_name;
  const delta = r.quantity_delta > 0 ? `+${r.quantity_delta}` : String(r.quantity_delta);
  const when = new Date(r.created_at).toLocaleString("pt-BR");
  console.log(
    `[${when}] ${r.movement_type.padEnd(10)} ${delta.padStart(5)}  ${target}  ${r.notes ?? ""}`,
  );
}
console.log("");

console.log("=== FIM ===");
console.log(`Total de drifts detectados: ${driftCount}`);
console.log("");
if (driftCount > 0) {
  console.log(
    "Drift > 0 indica que o cache (product.stock_quantity) está dessincronizado",
  );
  console.log("da fonte da verdade (sum de stock_movement.quantity_delta).");
  console.log("Próximo passo: investigar trigger sync_stock_cache_on_movement.");
}

await client.end();
