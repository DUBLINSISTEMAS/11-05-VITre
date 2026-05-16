/**
 * Vitrê service worker — Fase 6 / ADR-0017.
 *
 * Estratégia:
 *   - cache-first pra assets estáticos (/_next/static, /brand, /icons, fontes)
 *   - sem cache pra HTML/RSC (admin precisa estar sempre fresh)
 *   - skipWaiting + clientsClaim pra atualizar SW na próxima request
 *
 * NÃO usa Workbox de propósito — overhead pra problema simples.
 * Manter este arquivo curto e legível.
 */

const CACHE_VERSION = "vitre-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener("install", (event) => {
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
    url.pathname.startsWith("/brand/") ||
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
