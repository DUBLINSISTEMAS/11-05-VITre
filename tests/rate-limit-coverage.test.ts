/**
 * Sprint 6E — sentinela de cobertura de rate limit.
 *
 * Per CLAUDE.md princípio 6: toda mutation `"use server"` que chama
 * `withTenant` deve invocar `checkRateLimit(rateLimits.mutation, userId)`.
 * Reads (`load*`, `search*`) ficam SEM rate limit (autenticadas +
 * escopadas via RLS) — exceção legítima.
 *
 * Esta sentinela varre src/actions/** procurando arquivos que tenham
 * `withTenant` mas NÃO `checkRateLimit`, e checa cada um contra a
 * allowlist de reads. Falha = mutation nova esqueceu rate limit.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

const ACTION_FILES = walk("src/actions");

/**
 * Arquivos com leituras puras (CLAUDE.md princípio 3 e 6).
 * Allowlist explícita — qualquer arquivo novo aqui precisa ser
 * deliberado.
 *
 * Critério pra estar nesta lista:
 *   - Nome casa com `load*`, `search*`, `*types*`, `range`, `store-info`
 *   - Helper interno (chamado por outras actions, não diretamente
 *     pelo client)
 */
const READS_AND_HELPERS_ALLOWLIST: ReadonlyArray<string> = [
  // Reads puras
  "load.ts",
  "load-detail.ts",
  "load-pending.ts",
  "load-day-summary.ts",
  "load-sales.ts",
  "load-top.ts",
  "load-margin.ts",
  "load-dre.ts",
  "search.ts",
  "search-for-pdv.ts",
  "load-for-pdv.ts", // category/load-for-pdv.ts — read pro picker do PDV
  "global.ts", // search/global.ts — busca admin cmd+K
  // Tipos exportados (não são actions)
  "types.ts",
  // Helpers shared
  "range.ts",
  "store-info.ts",
  "internal.ts", // coupon/internal.ts — helpers chamados por outras actions
];

function isAllowedRead(file: string): boolean {
  const base = file.split(/[\\/]/).pop() ?? "";
  return READS_AND_HELPERS_ALLOWLIST.includes(base);
}

for (const file of ACTION_FILES) {
  const src = readFileSync(file, "utf8");
  const isServerAction = src.includes('"use server"');
  if (!isServerAction) continue;

  const usesWithTenant = src.includes("withTenant");
  const hasRateLimit = src.includes("checkRateLimit");

  // Pula reads e helpers da allowlist.
  if (isAllowedRead(file)) continue;

  if (usesWithTenant && !hasRateLimit) {
    test(`${file}: mutation sem rate limit (FAIL)`, () => {
      assert.fail(
        `${file} usa withTenant mas não chama checkRateLimit. ` +
          `Mutations devem ter rate limit (CLAUDE.md princípio 6). ` +
          `Se for read puro, renomeie pra load*/search* OU adicione ` +
          `o nome à READS_AND_HELPERS_ALLOWLIST deste teste.`,
      );
    });
  } else {
    // Test "vazio" garante que cada mutation aparece na suite (debug)
    test(`${file}: mutation tem rate limit (OK)`, () => {
      if (usesWithTenant) {
        assert.ok(hasRateLimit, "mutation precisa de checkRateLimit");
      }
    });
  }
}
