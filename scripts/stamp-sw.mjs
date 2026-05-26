/**
 * Stamp do service worker — S4.7 do Plano de Endurecimento.
 *
 * Substitui CACHE_VERSION em public/sw.js pela data corrente (YYYYMMDD).
 * Rodado automaticamente no `prebuild` do `next build` (Vercel).
 *
 * Por quê:
 *   Sem isso, sw.js mantém token antigo entre deploys e usuários com PWA
 *   instalado ficam vendo build velho (cache stale do navegador). Já
 *   resolvido manualmente em 2026-05-26 (commit 7a942e1) — automatizando
 *   agora pra não esquecer.
 *
 * Idempotente. Roda local + CI sem efeito acumulado.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SW_PATH = path.resolve(process.cwd(), "public/sw.js");

const today = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
const newToken = `mangospay-${today}`;

const content = await readFile(SW_PATH, "utf8");
const re = /(const CACHE_VERSION = ")[^"]+(")/;
const match = content.match(re);
if (!match) {
  console.error(`✗ stamp-sw: padrão CACHE_VERSION não encontrado em ${SW_PATH}`);
  process.exit(1);
}

if (match[0].includes(newToken)) {
  console.log(`✓ stamp-sw: ${newToken} (já atual, no-op)`);
  process.exit(0);
}

const updated = content.replace(re, `$1${newToken}$2`);
await writeFile(SW_PATH, updated, "utf8");
console.log(`✓ stamp-sw: CACHE_VERSION atualizado pra ${newToken}`);
