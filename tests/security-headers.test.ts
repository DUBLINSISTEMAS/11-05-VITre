/**
 * Tests sentinela dos security headers (Sprint 6B).
 *
 * Configuração viva em next.config.ts (já implementado em Fase 1.6).
 * Estes testes garantem que as diretivas críticas continuem presentes
 * mesmo após alguém mexer no config — detecção de regressão.
 *
 * Não testa runtime — testa source. Smoke test runtime ficará pra
 * pós-deploy via curl/Postman.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadConfigSource(): string {
  return readFileSync("next.config.ts", "utf8");
}

// ---------------------------------------------------------------------
// CSP — diretivas críticas que MITIGAM XSS
// ---------------------------------------------------------------------

test("CSP define default-src 'self' (lockdown padrão)", () => {
  const s = loadConfigSource();
  assert.match(s, /"default-src 'self'"/);
});

test("CSP bloqueia objects (object-src 'none')", () => {
  const s = loadConfigSource();
  assert.match(s, /"object-src 'none'"/);
});

test("CSP frame-ancestors 'none' global (anti-clickjacking)", () => {
  const s = loadConfigSource();
  assert.match(s, /"frame-ancestors 'none'"/);
});

test("CSP form-action 'self' (anti-CSRF redirect)", () => {
  const s = loadConfigSource();
  assert.match(s, /"form-action 'self'"/);
});

test("CSP base-uri 'self' (anti base-tag injection)", () => {
  const s = loadConfigSource();
  assert.match(s, /"base-uri 'self'"/);
});

test("CSP upgrade-insecure-requests (força HTTPS no client)", () => {
  const s = loadConfigSource();
  assert.match(s, /"upgrade-insecure-requests"/);
});

test("CSP img-src whitelista APENAS Supabase + data: + blob:", () => {
  const s = loadConfigSource();
  // Garante que img-src não foi relaxado pra * (qualquer fonte)
  assert.match(
    s,
    /"img-src 'self' https:\/\/\*\.supabase\.co data: blob:"/,
  );
});

// ---------------------------------------------------------------------
// HSTS — força HTTPS
// ---------------------------------------------------------------------

test("HSTS com 2 anos + includeSubDomains + preload", () => {
  const s = loadConfigSource();
  assert.match(s, /max-age=63072000/);
  assert.match(s, /includeSubDomains/);
  assert.match(s, /preload/);
});

// ---------------------------------------------------------------------
// X-* headers críticos
// ---------------------------------------------------------------------

test("X-Frame-Options DENY global (anti-clickjacking legado)", () => {
  const s = loadConfigSource();
  assert.match(s, /key:\s*"X-Frame-Options"[\s\S]*value:\s*"DENY"/);
});

test("X-Content-Type-Options nosniff (anti MIME confusion)", () => {
  const s = loadConfigSource();
  assert.match(s, /"X-Content-Type-Options"[\s\S]*"nosniff"/);
});

test("Referrer-Policy strict-origin-when-cross-origin", () => {
  const s = loadConfigSource();
  assert.match(s, /"strict-origin-when-cross-origin"/);
});

// ---------------------------------------------------------------------
// Permissions-Policy — APIs do browser desligadas
// ---------------------------------------------------------------------

test("Permissions-Policy desliga camera/mic/geo/FLoC", () => {
  const s = loadConfigSource();
  assert.match(s, /camera=\(\)/);
  assert.match(s, /microphone=\(\)/);
  assert.match(s, /geolocation=\(\)/);
  assert.match(s, /interest-cohort=\(\)/);
});

// ---------------------------------------------------------------------
// Aplicação — global vs preview
// ---------------------------------------------------------------------

test("headers global aplica em /:path* (todas as rotas)", () => {
  const s = loadConfigSource();
  assert.match(s, /source:\s*"\/:path\*"/);
});

test("preview em /admin/aparencia/preview relaxa frame-ancestors", () => {
  const s = loadConfigSource();
  assert.match(s, /\/admin\/aparencia\/preview\/:path\*/);
  // PREVIEW_SECURITY_HEADERS troca 'none' → 'self'
  assert.match(s, /"frame-ancestors 'self'"/);
});
