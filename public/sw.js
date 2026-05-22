/**
 * Mangos Pay service worker — Fase 6 / ADR-0017.
 *
 * Estratégia:
 *   - cache-first pra assets estáticos (/_next/static, /brand, /icons, fontes)
 *   - sem cache pra HTML/RSC (admin precisa estar sempre fresh)
 *   - skipWaiting + clientsClaim pra atualizar SW na próxima request
 *
 * NÃO usa Workbox de propósito — overhead pra problema simples.
 * Manter este arquivo curto e legível.
 *
 * CACHE_VERSION:
 *   ⚠️ BUMP THIS ON DEPLOY (ou troque a data abaixo). Sem bump, clients
 *   antigos continuam servindo chunks velhos mesmo após push novo. O hash
 *   ideal seria injetar process.env.NEXT_PUBLIC_BUILD_ID em build, mas
 *   service workers são servidos como arquivo estático bruto (sem
 *   bundling), então a forma robusta exigiria um script de build (`scripts/
 *   stamp-sw.mjs`) substituindo o token na hora do `next build`.
 *
 *   Por ora, regra operacional:
 *     1. Mudou /sw.js, /_next/static, ou qualquer asset em /public que
 *        seja servido cache-first → bumpar a data abaixo.
 *     2. /_next/static já tem hash no nome do arquivo (Next.js fingerprinting),
 *        então mudanças em chunks JS/CSS NÃO precisam de bump aqui — só
 *        bump se mudar a estratégia de cache ou os assets de /public.
 */

// Formato: mangospay-YYYYMMDD — BUMP THIS ON DEPLOY se mudou estratégia de cache.
const CACHE_VERSION = "mangospay-20260519";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/logos/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff");

  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res.ok) {
          // clone porque response stream só pode ser lida uma vez
          cache.put(request, res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        // offline + cache miss — propaga erro pro navegador
        throw e;
      }
    })(),
  );
});
