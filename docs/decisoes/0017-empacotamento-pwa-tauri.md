# ADR-0017: Empacotamento desktop — PWA agora, Tauri vetado até dor concreta

- **Data**: 2026-05-16
- **Status**: aceito
- **Deriva de**: [ADR-0012](0012-pivot-vitre-gestao.md) (Fase 6 do pivô)
- **Substitui implicitamente**: o item "Electron" do `CLAUDE.md` (já vetado lá)
- **Convive com**:
  - [ADR-0016](0016-pdv-balcao.md) — PDV é a UI mais sensível a "parece app"
  - [ADR-0018](0018-suporte-remoto-fora-do-produto.md) — suporte remoto NÃO entra no produto

## Contexto

Sandra (piloto) e Cliente B (prospect) usam Android no balcão e desktop atrás
do caixa. Após Fase 5 (PDV), o feedback recorrente é:

> "Daria pra abrir o sistema como um aplicativo? Sem ficar com a barra
> do navegador?"

Hoje cada acesso passa por: abrir Chrome → digitar `vitre.site/admin` →
logar. Atrito desproporcional pra rotina de balcão.

**Restrições não-negociáveis:**

1. **Custo zero permanente.** Tauri exige certificado de assinatura Windows
   (~R$ 1.500/ano) + bucket pra updater. Sai do free tier Vercel/Supabase
   logo na primeira release pública. Inaceitável até cliente pagante.
2. **Sem rewrite.** A regra do pivô é entregar com a stack existente,
   não troca de framework.
3. **Funciona em celular e desktop.** Sandra usa Android principalmente.
   Solução desktop-only não atende.
4. **Offline NÃO é requisito de MVP.** Vendas balcão acontecem com
   internet 99% do tempo (loja física tem WiFi). Sync robusto offline-first
   = 200-400h de engenharia.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A.** PWA (manifest + service worker + meta tags) — instalável via "Adicionar à tela inicial" no Chrome Android E desktop | Zero custo, zero dependência nova, atende mobile + desktop, atalho funciona em iOS/Android/Windows/macOS, cache offline opcional de assets estáticos | Sem acesso a impressora térmica via Web Serial em iOS Safari; ícone "fora do navegador" no desktop só com Chrome/Edge (Firefox não suporta install) |
| **B.** Tauri 2.x (Rust + WebView nativo) | Janela nativa real, acesso a Web Serial/printer, auto-updater, ícone na taskbar com badge | R$1500/ano cert Windows, bucket pra updater (paid), ~30h pra primeiro build pipeline, exige Rust no setup, NÃO cobre mobile (precisa Tauri Mobile separado, ainda alfa) |
| **C.** Electron | Familiar, comunidade grande | Vetado em CLAUDE.md ("perdeu para Tauri por tamanho de bundle"); ~150MB por install, RAM hog, sem Tauri Mobile equivalent |
| **D.** Capacitor (PWA + native wrapper iOS/Android) | Cobre mobile nativo | App Store + Play Store reviews quinzenais, conta dev Apple R$ 600/ano, custo de manutenção alto pra micro-varejo |

**Escolhida: A (PWA agora) + revisitar B (Tauri) em ADR-0017b futuro quando aparecer dor concreta de cliente pagante** — tipicamente:
- "Preciso imprimir cupom térmico sem diálogo"
- "WiFi caiu e tenho que vender" (offline real)
- "Quero ícone na taskbar com badge de pedidos novos"

Até lá, PWA cobre 80% da percepção de "é um app". Sem decisão prematura.

## Decisão

Implementar PWA mínimo viável agora:

1. `public/manifest.webmanifest` declarando `display: standalone`, ícones,
   theme color, scope, start URL.
2. **Ícones 192×192 e 512×512** gerados via sharp do `logo-principal.webp`,
   versão `maskable` pra Android adaptativo.
3. **Service worker básico** (`public/sw.js` — vanilla, sem Workbox) com:
   - cache-first pra assets estáticos (`/brand/*`, `/_next/static/*`, fonts)
   - network-first pra HTML/RSC (fresh by default; cache só fallback)
   - skipWaiting + clientsClaim pra updates rápidos
4. **Meta tags Apple iOS** (apple-touch-icon, apple-mobile-web-app-*).
5. **Registro do SW** num client component pequeno (`<PwaRegister />`)
   montado no root layout.
6. **NÃO** implementar cache de RSC do admin (estoque/pedidos mudam o tempo
   todo; cache desatualizado vira bug em produção). Cache só de **estáticos**.

**Não implementado nesta fase:**

- Background sync (offline write queue) — só com demanda
- Push notifications — exige domínio próprio + cert, ADR separado
- Workbox / next-pwa — overhead pra problema simples; SW vanilla cobre
- App Store / Play Store wrappers — vetado em ADR-0018

## Veto Tauri (e revisão futura)

Tauri permanece vetado para a Fase 6 MVP. Gatilhos pra abrir ADR-0017b:

1. Cliente pagante pede impressão térmica sem diálogo
2. Sandra reporta perda de venda por queda de WiFi ≥ 2x em 30 dias
3. Demanda comprovada de "ícone na taskbar com contagem de pedidos"

Sem nenhum dos três, qualquer "deveria virar app desktop" é especulação.

## Schema PWA

```json
// public/manifest.webmanifest
{
  "name": "Vitrê — Gestão",
  "short_name": "Vitrê",
  "description": "Sistema de gestão de loja: catálogo, PDV, estoque.",
  "start_url": "/admin",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#1E3FE6",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["business", "shopping"],
  "lang": "pt-BR"
}
```

## Service worker

```js
// public/sw.js — vanilla, sem deps
const CACHE_VERSION = 'vitre-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Cache-first para estáticos
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
  }
  // Network-only pra RSC/HTML — sem fallback (admin precisa fresh)
});
```

## Riscos & follow-ups

### Positivas
- Sandra abre Vitrê no atalho do celular, sem barra do Chrome
- Atalho na desktop com ícone no taskbar (Windows 11 + Chrome/Edge)
- Cache de estáticos reduz consumo de banda da loja

### Negativas / riscos
- iOS exige usuário ir em "Compartilhar → Adicionar à Tela de Início" manualmente (sem prompt)
- Atualizações do SW podem ficar "presas" se cliente não recarregar — `skipWaiting + clientsClaim` mitigam mas não eliminam
- Sem Web Serial em iOS → impressão térmica via Tauri (futuro)
- Storefront público também ganha PWA (mesmo scope `/`) — aceitável; cliente final pode instalar a vitrine da Sandra como atalho

### Follow-ups
- Ícones por loja (lojista subindo logo) — Storefront PWA por tenant
- Splash screens iOS dedicadas (10+ resoluções) — opcional
- Push notification de pedido novo no admin — ADR separado
- Background sync de PDV (offline-first) — gatilho de "WiFi caiu 2x"

## Plano de implementação

1. Gerar ícones 192/512 + maskable via `scripts/generate-pwa-icons.mjs` (sharp)
2. Criar `public/manifest.webmanifest`
3. Criar `public/sw.js`
4. Componente `<PwaRegister />` client-side no `app/layout.tsx`
5. Adicionar meta tags Apple no `metadata` do root layout
6. Adicionar `manifest` à `Metadata`
7. Test smoke local: Chrome DevTools → Application → Manifest + Service Worker
