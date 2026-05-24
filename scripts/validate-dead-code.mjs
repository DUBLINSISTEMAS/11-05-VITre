/**
 * Valida candidatos de dead code do ts-prune.
 * Pra cada export listado: faz search em src/ + tests/ excluindo o próprio arquivo.
 * Output: lista categorizada em docs/auditoria-2026-05-21/_dead-code-raw.json
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync("ts-prune-raw.txt", "utf8");
const entries = raw.split("\n").filter(Boolean);

// 1. Coleta todos os arquivos .ts/.tsx em src/ e tests/
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}
const allFiles = [...walk("src"), ...walk("tests")];
console.log(`Indexando ${allFiles.length} arquivos...`);

// 2. Mapa arquivo → conteúdo
const contents = new Map();
for (const f of allFiles) {
  contents.set(f.replace(/\\/g, "/"), readFileSync(f, "utf8"));
}

// 3. Helpers
const nextRouteNames = new Set([
  "default", "metadata", "viewport", "revalidate",
  "generateMetadata", "generateStaticParams", "generateViewport",
  "dynamic", "dynamicParams", "fetchCache", "preferredRegion",
  "runtime", "maxDuration",
]);

const reExportFiles = new Set([
  "src/db/schema/index.ts",
  "src/db/schema/order.ts",
  "src/actions/coupon/index.ts",
  "src/actions/customer-group/index.ts",
  "src/actions/storefront-collection/index.ts",
]);

const results = {
  real_dead: [],
  false_next: [],
  false_reexport: [],
  false_used: [],
  unknown: [],
};

for (const line of entries) {
  const m = line.match(/^\\(.+?\.tsx?):(\d+) - (.+?)( \(used in module\))?$/);
  if (!m) {
    results.unknown.push(line);
    continue;
  }
  const [, filePath, lineNum, name] = m;
  const fileNorm = filePath.replace(/\\/g, "/");

  // 1. Next.js route convention
  if (fileNorm.startsWith("src/app/") && nextRouteNames.has(name)) {
    results.false_next.push({ file: fileNorm, line: lineNum, name });
    continue;
  }

  // 2. Re-export aggregator
  if (reExportFiles.has(fileNorm)) {
    results.false_reexport.push({ file: fileNorm, line: lineNum, name });
    continue;
  }

  // 3. Busca por callsites no resto do código
  const callsites = [];
  // Regex word-boundary pra evitar match em substring
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`);
  for (const [p, content] of contents) {
    if (p === fileNorm) continue;
    if (re.test(content)) {
      callsites.push(p);
      if (callsites.length >= 5) break; // bastam 5 pra confirmar uso
    }
  }

  if (callsites.length === 0) {
    results.real_dead.push({ file: fileNorm, line: lineNum, name });
  } else {
    results.false_used.push({ file: fileNorm, line: lineNum, name, callsites });
  }
}

writeFileSync(
  "docs/auditoria-2026-05-21/_dead-code-raw.json",
  JSON.stringify(results, null, 2),
);

console.log(`\nTotal candidatos: ${entries.length}`);
console.log(`  REAL DEAD:        ${results.real_dead.length}`);
console.log(`  False (Next.js):  ${results.false_next.length}`);
console.log(`  False (re-export):${results.false_reexport.length}`);
console.log(`  False (used):     ${results.false_used.length}`);
console.log(`  Unknown:          ${results.unknown.length}`);

console.log("\n=== REAL DEAD CODE ===");
const byFile = new Map();
for (const r of results.real_dead) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(`${r.name} (L${r.line})`);
}
for (const [file, items] of byFile) {
  console.log(`  ${file}`);
  for (const it of items) console.log(`    - ${it}`);
}
