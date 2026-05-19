/**
 * Static-analysis tests para `src/app/api/cron/expire-orders/route.ts`.
 *
 * Cenários cobertos (via invariantes estruturais — mesmo padrão dos outros
 * tests do repo, ver `tests/order-actions.test.ts`):
 *
 *  1. Auth 401             — header faltando/inválido retorna Unauthorized
 *                              (validado via `crypto.timingSafeEqual`,
 *                              não comparação `===` direta).
 *  2. Batch vazio          — sem candidates, não há revalidate, não há
 *                              UPDATE, retorna 200 com expired=0.
 *  3. 1 pedido expirado    — restock + UPDATE status='expired' na MESMA
 *                              transação `withTenant`.
 *  4. confirmed ignorado   — WHERE filtra `status = 'awaiting_whatsapp'`,
 *                              pedido confirmed mesmo com expires_at
 *                              passado NÃO é tocado.
 *  5. Multi-loja revalida  — Set de slugs touched + revalidateTag em loop
 *                              dispara um tag por loja afetada.
 *  6. Falha continua batch — try/catch por pedido + agregação de erros,
 *                              uma falha não derruba o resto.
 *
 * Também valida:
 *  - vercel.json registra o schedule sem mexer no keep-alive.
 *  - cron usa `withServiceRole` pro SELECT cross-tenant e `withTenant`
 *    pro processamento por pedido.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadCronSource(): string {
  return readFileSync("src/app/api/cron/expire-orders/route.ts", "utf8");
}

function loadCronAuthSource(): string {
  return readFileSync("src/lib/cron-auth.ts", "utf8");
}

// ---------------------------------------------------------------------
// Cenário 1: Auth 401 + timing-safe
// ---------------------------------------------------------------------

test("cron expire-orders: rejeita request sem Authorization (401)", () => {
  const source = loadCronSource();
  // Retorna `Unauthorized` 401 quando header falta ou é inválido.
  assert.match(source, /new Response\("Unauthorized",\s*\{\s*status:\s*401\s*\}\)/);
});

test("cron expire-orders: delega auth pro helper compartilhado isAuthorizedCron", () => {
  // Onda 2 da auditoria 2026-05-10 extraiu auth pra `@/lib/cron-auth`
  // (DRY entre expire-orders e keep-alive). Onda A 2026-05-18 trocou
  // o nome pra `isAuthorizedCron(request, pathname)` — pathname entra
  // no HMAC pra evitar replay cross-route (Hobby usa query ?sig=...
  // porque Vercel Hobby não injeta Authorization header).
  const source = loadCronSource();
  assert.match(source, /isAuthorizedCron/);
  assert.match(source, /from\s+["']@\/lib\/cron-auth["']/);
  // Pathname canônico passado pro helper (hard-coded — sem smuggling
  // via X-Forwarded-Host).
  assert.match(source, /CRON_PATHNAME\s*=\s*["']\/api\/cron\/expire-orders["']/);
  // Sanidade: header NÃO pode ser comparado direto com === em string
  // (timing attack). Helper centralizado evita drift.
  assert.doesNotMatch(
    source,
    /authHeader\s*!==\s*`Bearer \$\{env\.CRON_SECRET\}`/,
  );
});

test("cron-auth helper: aceita header Bearer OU query ?sig HMAC (Hobby fallback)", () => {
  // Vercel Hobby NÃO injeta `Authorization` header — sem este fallback,
  // os crons retornam 401 silencioso e nunca executam (memory team
  // `vercel-cron-hobby-no-auth-header`).
  const source = loadCronAuthSource();
  // Header Bearer continua válido (Pro+).
  assert.match(source, /headers\.get\(["']authorization["']\)/);
  // Query ?sig=<hmac>.
  assert.match(source, /searchParams\.get\(["']sig["']\)/);
  // HMAC-SHA256 sobre pathname.
  assert.match(source, /createHmac\(["']sha256["'],\s*env\.CRON_SECRET\)/);
});

test("cron-auth helper: signCronUrl gera path?sig=<hex> e rejeita pathname desconhecido", () => {
  // signCronUrl é o helper que scripts/sign-cron-urls.ts chama pra
  // gerar o valor que vai em vercel.json. Pathname unknown DEVE jogar —
  // senão founder gera HMAC pra rota errada e cron quebra silencioso.
  const source = loadCronAuthSource();
  assert.match(source, /export function signCronUrl/);
  assert.match(source, /CRON_PATHS\s*=\s*new Set/);
  assert.match(source, /pathname desconhecido/);
});

test("cron-auth helper: usa crypto.timingSafeEqual (não comparação ===)", () => {
  // Comparação constant-time é obrigatória pra evitar timing attack.
  const source = loadCronAuthSource();
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /from\s+["']node:crypto["']/);
});

// ---------------------------------------------------------------------
// Cenário 2: Batch vazio
// ---------------------------------------------------------------------

test("cron expire-orders: SELECT cross-tenant via withServiceRole", () => {
  const source = loadCronSource();
  assert.match(source, /withServiceRole/);
  // Reason logado pra forensics (convenção de tenant.ts).
  assert.match(source, /cron expire-orders/);
});

test("cron expire-orders: filtra status='awaiting_whatsapp' E expires_at < now()", () => {
  const source = loadCronSource();
  // O WHERE precisa cobrir AS DUAS condições — só uma pega pedidos errados:
  // sem o status filter, pegaria confirmed/canceled também (cenário 4).
  assert.match(source, /eq\(orderTable\.status,\s*["']awaiting_whatsapp["']\)/);
  assert.match(source, /lt\(orderTable\.expiresAt,\s*sql`now\(\)`\)/);
});

// ---------------------------------------------------------------------
// Cenário 3: Restock + UPDATE na mesma transação withTenant
// ---------------------------------------------------------------------

test("cron expire-orders: cada pedido roda em withTenant próprio", () => {
  const source = loadCronSource();
  // Aceita `withTenant(` ou `withTenant<...>(` (com type param).
  assert.match(source, /\bwithTenant(?:<[^>]+>)?\s*\(/);
  // ANON_USER_ID — cron não tem userId real, usa constante de @/lib/tenant.
  assert.match(source, /ANON_USER_ID/);
});

test("cron expire-orders: dispara restockOrderItems ANTES do UPDATE", () => {
  const source = loadCronSource();
  assert.match(source, /import\s*\{[^}]*restockOrderItems/);
  const restockIdx = source.indexOf("restockOrderItems(tx");
  const updateIdx = source.indexOf(".update(orderTable)");
  assert.ok(
    restockIdx > 0 && updateIdx > 0,
    "esperava restockOrderItems(tx, ...) e .update(orderTable) presentes",
  );
  assert.ok(
    restockIdx < updateIdx,
    "restock deve rodar ANTES do UPDATE de status (mesma transação)",
  );
});

test("cron expire-orders: UPDATE de status usa optimistic lock", () => {
  const source = loadCronSource();
  // WHERE inclui `status = 'awaiting_whatsapp'` — se outro fluxo (ex:
  // lojista cancelando manualmente) já mudou, UPDATE vira no-op em vez
  // de double-restock.
  const updateBlock = source.slice(source.indexOf(".update(orderTable)"));
  assert.match(
    updateBlock,
    /eq\(orderTable\.status,\s*["']awaiting_whatsapp["']\)/,
  );
});

// ---------------------------------------------------------------------
// Cenário 5: Multi-loja revalida múltiplos tags
// ---------------------------------------------------------------------

test("cron expire-orders: revalidateTag por loja afetada (Set evita duplicação)", () => {
  const source = loadCronSource();
  // Set garante 1 revalidate por slug, não 1 por pedido (wasteful).
  assert.match(source, /storesTouched\s*=\s*new Set</);
  assert.match(source, /storesTouched\.add\(/);
  assert.match(source, /for\s*\(\s*const\s+slug\s+of\s+storesTouched\s*\)/);
  assert.match(source, /revalidateTag\(`store-\$\{slug\}`\)/);
});

// ---------------------------------------------------------------------
// Cenário 6: Falha mid-batch não derruba o resto
// ---------------------------------------------------------------------

test("cron expire-orders: try/catch por pedido + agregação de erros", () => {
  const source = loadCronSource();
  // Loop com try/catch INTERNO pra cada pedido — Promise.all sem catch
  // ou single try externo seriam antipatterns aqui.
  assert.match(source, /for\s*\(\s*const\s+candidate\s+of\s+candidates\s*\)/);
  // Dentro do for, try/catch.
  const loopStart = source.indexOf("for (const candidate of candidates)");
  const loopEnd = source.indexOf("\n  }\n", loopStart);
  const loopBody = source.slice(loopStart, loopEnd);
  assert.match(loopBody, /try\s*\{/);
  assert.match(loopBody, /catch\s*\(/);
});

test("cron expire-orders: payload de resposta inclui contadores de health", () => {
  const source = loadCronSource();
  // expired + errors + storesTouched permitem monitor da Vercel
  // detectar degradação.
  assert.match(source, /expired:\s*expiredCount/);
  assert.match(source, /errors:\s*errorCount/);
  assert.match(source, /storesTouched:\s*storesTouched\.size/);
});

test("cron expire-orders: status 500 quando errors > expired (degradação)", () => {
  const source = loadCronSource();
  // Sinal pro Vercel monitor — se mais pedidos falharam que sucederam,
  // algo sistêmico está quebrado.
  assert.match(source, /errorCount\s*>\s*expiredCount.*500/s);
});

// ---------------------------------------------------------------------
// Boilerplate Next 15 + segurança
// ---------------------------------------------------------------------

test("cron expire-orders: declara runtime nodejs e dynamic force-dynamic", () => {
  const source = loadCronSource();
  // pg/Node APIs (timingSafeEqual) precisam de runtime nodejs, não edge.
  assert.match(source, /export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  assert.match(source, /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
});

// ---------------------------------------------------------------------
// vercel.json — schedule registrado
// ---------------------------------------------------------------------

test("vercel.json: cron expire-orders registrado sem mexer no keep-alive", () => {
  const source = readFileSync("vercel.json", "utf8");
  const config = JSON.parse(source) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  const crons = config.crons ?? [];
  // Path agora inclui `?sig=<hmac>` (Onda A 2026-05-18) — placeholder
  // local até founder gerar via `pnpm exec tsx scripts/sign-cron-urls.ts`.
  // Test casa contra o pathname-base, ignorando query.
  const keepAlive = crons.find((c) =>
    c.path.startsWith("/api/cron/keep-alive"),
  );
  assert.ok(keepAlive, "keep-alive cron deve continuar registrado");
  assert.equal(keepAlive!.schedule, "0 9 * * *");
  assert.match(keepAlive!.path, /\?sig=/);
  const expire = crons.find((c) =>
    c.path.startsWith("/api/cron/expire-orders"),
  );
  assert.ok(expire, "expire-orders cron deve estar registrado");
  assert.equal(expire!.schedule, "0 6 * * *");
  assert.match(expire!.path, /\?sig=/);
});
