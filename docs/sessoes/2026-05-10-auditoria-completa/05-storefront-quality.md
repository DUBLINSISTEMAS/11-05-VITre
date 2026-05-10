# Relatório 05 — Storefront Quality + Repo Health

Auditoria estática pré-deploy (2026-05-10). Sem execução de build/dev; só leitura + Grep/Glob. Outros agents cobrem DB/RLS, uploads, admin UI runtime e server actions — esses tópicos foram intencionalmente omitidos aqui.

---

## Sumário executivo

**Storefront**: a base é sólida. ISR via `unstable_cache` está bem estruturado (loaders em `src/lib/storefront/*-loader.ts` com TTL 300s e tag `store-${slug}`), 25 mutações no `actions/` chamam `revalidateTag` corretamente, SEO mínimo cobre todos os boundaries (metadata + OpenGraph + sitemap + robots + JSON-LD em PDP), e a11y é decente (skip link, aria-labels em nav/dots/swatches, role=radio/radiogroup em variantes, sr-only no botão voltar). A pegada visual canvas-v1 está consistente entre páginas.

**Porém há contradições graves com ADR-0008 e o canvas que precisam ser resolvidas antes do deploy**:

1. **`/favoritos` e `/perfil` violam ADR-0008** (zero login no storefront / "wedge é cliente final sem cadastro"). `/perfil` ainda tem links pra rotas que não existem (`/pedidos`, `/enderecos`, `/ajuda`).
2. **Bottom nav linka pra `/[storeSlug]/categoria`** (sem slug) — rota inexistente. 404 garantido se usuário clicar no item "Categorias".
3. **`banner-carousel.tsx`, `category-pills.tsx`, `toast.tsx` (ToastProvider/useToast etc) usam `framer-motion`** que o CLAUDE.md/decisões removeram. CLAUDE.md anuncia stack "sem framer-motion" mas dep ainda está em `package.json` (^12.38.0) e 6 arquivos consomem.
4. **`/sobre` duplica `/perfil`** com objetivo idêntico (info da loja) e só `/sobre` é correto pela ADR.

**Repo health**: dívida moderada. `package.json` lista `vitre` mas memória diz pnpm canônico; `lottie-react` mencionado no CLAUDE.md está ausente de `dependencies` (sumiu) e nenhum arquivo importa lottie — drift. Docs estão desatualizadas (CONTEXT.md marca Fase 1.6 concluída e roadmap idem, mas CLAUDE.md diz "Fase 1.4 concluída"; commits recentes são de redesign canvas-v1, ortogonal ao roadmap). Test suite com 1 erro TS conhecido (regex flag `/v/ → ES2017 target). Build production está limpo (16/21/35 páginas dependendo da versão do log).

**Veredito**: 4 críticos bloqueiam deploy, ~7 altos devem entrar no Lote 5 ou ADR novo. Médios/cosméticos podem ir pra backlog.

---

## Parte A — Storefront

### A.1 ISR / Cache

**Status: forte.**

- `src/lib/storefront/store-loader.ts:44-51` — `getStoreBySlug` envolve `unstable_cache` por slug com tag `store-${slug}` + React `cache()` pra dedup intra-request. Padrão exemplar (justificado no comentário, linhas 6-17).
- `src/lib/storefront/products-loader.ts:205-236, 288-301, 329-357` — `listProducts`, `getProductBySlug`, `getFeaturedProducts`, `getRecentProducts` todos com tag `store-${slug}` e `revalidate: 300`. Cache key inclui todos os filtros (linhas 217-227) → invalidação granular.
- `src/lib/storefront/categories-loader.ts:59-67` + `banners-loader.ts` — mesmo padrão.
- `revalidateTag('store-${slug}')` confirmado em **25 arquivos** de `src/actions/**` (Grep). Cobertura completa pra mutações que tocam catálogo público + 1 em `expire-orders/route.ts:152` (cron) + 1 em `order/create-from-cart.ts:495`.
- `src/app/sitemap.ts:24` — `export const revalidate = 3600`. Bom.

**Achados:**

- 🟡 `src/lib/storefront/store-loader.ts` define `STORE_CACHE_TAG` mas as actions hard-codam `\`store-${store.slug}\`` em string literal. Drift se a tag mudar (ex: namespace). [Consistência, não bug.]
- 🟡 `products-loader.ts` linha 230 cacheia `loadProductsFromDb(params, categoryIds)`, mas `params` inteiro é capturado dentro do closure — chave única é montada manualmente em `cacheKey` (linhas 217-227). Funciona, mas qualquer drift entre cacheKey e params vira cache poisoning silencioso.
- 🔵 Cache TTL 300s é generoso pra preço/estoque. Comentário (linha 13-15) reconhece "drift aceitável". OK pro MVP.

### A.2 SEO

**Status: bom, faltam alguns detalhes.**

- Root `src/app/layout.tsx:21-46` — metadata padrão + `metadataBase` + viewport com themeColor. Sem `maximumScale` (WCAG 2.1).
- Storefront layout `src/app/(storefront)/[storeSlug]/layout.tsx:27-54` — `generateMetadata` com title template `%s · ${store.name}`, OpenGraph com logo, icons fallback. Sólido.
- PDP `produto/[productSlug]/page.tsx:22-50` — metadata por produto + JSON-LD `Product` em `<script>` (linhas 70-100). Bem feito; escape `</script>` cuidadoso (linha 91).
- Categoria `categoria/[categorySlug]/page.tsx:67-82` — `generateMetadata` com title + description.
- Sacola/Sucesso — `metadata = { robots: { index: false, follow: false } }`. Correto.
- `src/app/sitemap.ts` — itera lojas ativas + produtos + categorias + `/sobre` + `/buscar`. Lê do DB via `withServiceRole`.
- `src/app/robots.ts` — disallow `/admin /api /criar-loja /entrar /recuperar /redefinir /p/`. Coerente.

**Achados:**

- 🟠 PDP `jsonLd.offers.availability` (linha 80-84) tem bug lógico: usa `hasActivePromo` pra decidir InStock. Se produto NÃO está em promo, cai no ternário e checa `isOutOfStock`, mas se está em promo, ignora estoque. Promo em produto esgotado vai pra Google como InStock.
- 🟠 PDP JSON-LD não inclui `sku`, `gtin`, `brand` (Google Merchant exige). Não fatal mas reduz CTR no Rich Results.
- 🟡 `/sobre`, `/destaques`, `/novidades`, `/favoritos`, `/perfil` não têm OpenGraph próprio (herdam só do layout). `/favoritos` em particular podia ser `noindex` (página dinâmica de cliente, sem valor SEO).
- 🟡 Falta `canonical` explícito nas páginas paginadas (`?page=2` na categoria gera duplicate content potencial). Usa `searchParams` puro sem `rel="canonical"`.
- 🟡 `next.config.ts:69-76` images.remotePatterns só libera `*.supabase.co`. Se houver banner externo no futuro precisa update — OK pra agora.
- 🔵 Title template no layout (`%s · ${store.name}`) é PT-BR mas Open Graph usa "type: website" — PDP poderia ser `product`. Não-crítico.

### A.3 Performance

**Status: bom.**

- `next/image` é usado consistentemente: `product-card.tsx:207-214` (fill + sizes + priority), `product-gallery.tsx:103-110`, `hero-card.tsx:74-82`, `banner-carousel.tsx:189-196`, `categories-sidebar.tsx` (vários), `category-strip.tsx`, `perfil/page.tsx:76-83` (width/height fixos pro logo), `favoritos/page.tsx:112-118` (com sizes responsivos).
- `priorityFirst` + `priorityCount` propagados pra LCP: home `priorityCount={2}` (page.tsx:121), categoria `priorityCount={1}` (categoria/page.tsx:164), busca `priorityCount={4}` (buscar/page.tsx:174). Coerente.
- RSC vs Client boundary: home/categoria/PDP/sucesso/sobre = Server; sacola/favoritos/buscar (header)/checkout/galeria/purchase panel/bottom-nav/header = Client. Boundaries fazem sentido.
- `prefetch={false}` nos `<Link>` internos do storefront — bom pra evitar prefetch agressivo do crawler do Next dentro da loja.
- Sem `dynamic(...)` import em nenhum lugar (`Grep dynamic(`) — código-splitting confiado ao Next default. Para o tamanho atual, OK.

**Achados:**

- 🟠 `src/components/storefront/toast.tsx:83` usa `<img>` em vez de `next/image` — flagrado em `_lint-output.log` e `_build-output.log`. Lint warning ativo.
- 🟠 `src/components/storefront/banner-carousel.tsx` (262 linhas, framer-motion + IntersectionObserver + auto-advance) é **dead code** (zero consumers, ver §B.1). Sai do bundle se não removido manualmente porque é tree-shakeável, mas é peso morto.
- 🟠 `categories-sidebar.tsx` é client e importa `framer-motion` no shell layout — entra no bundle inicial de TODA loja. Animação de sidebar não justifica 30+kb.
- 🟡 `product-card.tsx:135-184` usa duas variantes ("overlay" e "card") com lógica quase idêntica. Refatoração óbvia mas baixo impacto.
- 🟡 `hero-card.tsx:38-39` define gradient inline via CSS var `color-mix(in oklch, var(--brand-store) ...)` — funciona, mas browsers antigos sem `color-mix` recebem fallback nulo. Não-crítico.
- 🔵 `next.config.ts:78-80` `bodySizeLimit: 5mb` — confirma a politica "max 5 imagens 800×800 WebP 75% ~= 80kb cada" sobra muito. OK.

### A.4 Acessibilidade

**Status: razoável, com bugs notáveis.**

Pontos fortes:
- Skip link presente em `store-shell.tsx:55-60` com `focus:not-sr-only`. Bom.
- aria-labels: bottom-nav (`bottom-nav.tsx:138,191`), galeria (`product-gallery.tsx:91,125`), back button (`store-header.tsx:239`), variantes (`product-purchase-panel.tsx:233,245`), favoritos, sacola, buscar, banner-carousel etc.
- `role="radiogroup"` + `role="radio"` + `aria-checked` no seletor de tamanho (`product-purchase-panel.tsx:232,243-244`). Forma correta de seletor de variante.
- `aria-current="page"` nas tabs ativas (`bottom-nav.tsx:137,191,255`).
- `aria-hidden` em ícones decorativos consistente.
- `focus-visible:ring-2 focus-visible:ring-ring` em todos os interactive elements críticos.
- `aria-label="Voltar"` no back button.
- Forms: `Label htmlFor` correto, `aria-invalid` setado, `role="alert"` em erros (`checkout-panel.tsx:365`).
- viewport sem `maximumScale` (`src/app/layout.tsx:41-46`) — respeita zoom WCAG 1.4.4. Documentado.
- `<html lang="pt-BR">` em `layout.tsx:54`.

**Achados:**

- 🟠 `src/components/storefront/toast.tsx:108-113` botão fechar sem `aria-label` ("X" só visual). Lint warning provável (button without text content).
- 🟠 `categories-sidebar.tsx:108-114` `<SheetContent aria-describedby={undefined}>` desabilita explicitamente a description — `SheetDescription` (linha 140) está renderizado mas sem `aria-describedby` apontando pra ele. shadcn warning runtime.
- 🟠 `product-card.tsx:215-218` placeholder "Sem foto" é `<div>` puro sem `role="img" aria-label`. Screen reader pula.
- 🟡 `perfil/page.tsx:116-122` opções "disabled" usam `opacity-50 cursor-not-allowed` mas não setam `aria-disabled` — usuário de teclado não vê o estado.
- 🟡 `banner-carousel.tsx:132-147` botões prev/next visíveis só com `hidden md:flex group-hover:opacity-100`. Em hover é OK; teclado-only não consegue ver. Mas componente é dead code, baixa prioridade.
- 🟡 `checkout-panel.tsx:485-495` ícone WhatsApp tem `aria-hidden` faltando — `<svg aria-hidden>` é só atributo `aria-hidden` boolean true. OK aqui.
- 🟡 `product-gallery.tsx:117-134` dots de carrossel são `<button>` com `aria-label` mas sem `role="tab"`/`aria-selected`. Padrão WAI-ARIA carousel ficaria melhor. Aceitável.
- 🔵 Falta `lang="en"` quando texto fica em inglês — ex: `category-pills.tsx:38` "All", `categories-sidebar.tsx:141,182,206,209,329` "Browse categories", "All Products", "No categories yet", "View all in ...". Inconsistência idiomática (PT-BR padrão).

### A.5 Layout/UX

**Status: bons fundamentos, dois bugs sérios.**

- Bottom-nav `bottom-nav.tsx:55-73` — 4 itens (Home/Categorias/Buscar/Sacola), aderente ao ADR-0008.
- 3 variants (`pill | rule | glass`) configuráveis por loja via `store.bottomNavStyle`. Boa flexibilidade.
- Header tem 4 variants (`home | pdp-floating | sticky-title | category`) — `store-header.tsx:62-68`. Coerente com canvas.
- `shell-content.tsx:33-73` decide quando esconder header/bottom-nav/footer baseado no pathname. Lógica explícita e comentada.
- Sacola: drawer compacto (preview) + página `/sacola` completa (form + checkout) — separação UX clara.
- Sucesso: layout pixel-perfect canvas, 2 CTAs (WA + continuar). `SuccessClearCart` limpa carrinho no client.
- Checkout: form mínimo (nome/whatsapp/notas), validação RHF + Zod, idempotency key via `crypto.randomUUID`. WhatsApp escape correto (`buildPublicOrderWhatsAppMessage` + `buildWhatsAppUrl`).

**Achados:**

- 🔴 **`bottom-nav.tsx:62` aponta `Categorias` pra `/{storeSlug}/categoria`**. Glob confirma: rota `src/app/(storefront)/[storeSlug]/categoria/page.tsx` **não existe** — só existe `categoria/[categorySlug]/page.tsx`. Click no item Categorias gera 404 garantido.
  - Comentário em `store-shell.tsx:17` ainda menciona `useCategoriesSidebar()` (deve ser trigger do drawer lateral) — mas `bottom-nav` não consome o trigger. Aparente intenção: o item Categorias devia ABRIR a sidebar drawer, não navegar.
- 🔴 **`/favoritos` viola ADR-0008** (`CLAUDE.md` linha "Cadastro/login/perfil/favoritos/histórico/foto/endereço de CLIENTE FINAL"). Reafirmado: "Reabrir só com ADR novo se 5+ lojistas pedirem após MVP no ar". Não há ADR. `favoritos/page.tsx`, `favorite-button.tsx`, `use-favorites.ts` (existe — referenciado) precisam decisão.
- 🔴 **`/perfil` viola ADR-0008 e duplica `/sobre`**. `perfil/page.tsx:41-67` tem 4 menu items: "Meus Pedidos" → `/{slug}/pedidos` (rota inexistente — Glob), "Favoritos" → `/favoritos`, "Endereços" → `/enderecos` (rota inexistente, mas marcada `disabled`), "Ajuda" → `/ajuda` (idem). É telas de cliente final que ADR-0008 baniu.
- 🟠 `shell-content.tsx:42` `isProfilePage = pathname.endsWith("/perfil")` faz `/perfil` renderizar `<StoreFooter>` — só essa rota tem footer. Inconsistência (resto da loja não tem footer permanente).
- 🟠 `checkout-panel.tsx:289-313` sticky CTA bottom usa `position: fixed` no client component — em PWA / iOS Safari quando teclado abre, pode sobrepor o input. UX comum sem fix.
- 🟠 `success/page.tsx:68` redireciona quando `?code` ausente — bom, mas se `?code` é inválido (ex: usuário colou wrong), cai em `notFound()` (linha 75). Sem mensagem amigável "código não encontrado, talvez expirou".
- 🟡 `banner-carousel.tsx` é dead code (§B.1) mas `loading.tsx` ainda renderiza `BannerCarouselSkeleton`. Inconsistente: skeleton sem componente correspondente em uso (HeroCard substituiu BannerCarousel).
- 🟡 `category-strip.tsx` (home) + `category-pills.tsx` (buscar) + `category-filter-chips.tsx` (categoria) + `categories-sidebar.tsx` (drawer) — 4 componentes diferentes pra navegar categorias. Duplicação visível mas justificável (contextos distintos).
- 🟡 `categories-sidebar.tsx:183,206,209,329` mistura "Browse categories", "All Products", "View all in {name}" (inglês) com header PT-BR — inconsistência i18n.
- 🟡 `buscar/page.tsx:107-113` SearchBar com `enterKeyHint="search"` é bom; mas falta `autoFocus`-management explícito (em mobile teclado abre? Comentário em `categories-sidebar.tsx:9` ressalta `Search without auto-focus (prevents mobile keyboard)` — desejado).
- 🔵 `perfil/page.tsx:55,63` strings com encoding ASCII ("Enderecos", "Duvidas") em vez de UTF-8 ("Endereços", "Dúvidas"). Cosmético.

### A.6 Theming

**Status: correto.**

- `store-shell.tsx:45-47` injeta `--brand-store: store.primaryColor` no wrapper. Server-side inline style, zero hydration mismatch.
- `globals.css:65-70` define `--brand-store` com fallback `var(--primary)` (azul Vitrê).
- ADR-0011 limita uso: bottom-nav + badge sacola. Verificação:
  - `bg-brand-store` aparece em: `bottom-nav.tsx` (vários — pill ativa, badge), `hero-card.tsx:95,113`, `promo-strip.tsx` (não — usa warning-soft), `product-grid.tsx:68` (link "Ver todos"), `banner-carousel.tsx:230-243` (dead).
  - Uso em `hero-card.tsx` kicker + CTA + `product-grid.tsx` "Ver todos" extrapola o ADR-0011. Pode ser intencional (canvas-v1 redesign aceita brand-store mais permissivo) ou drift.
- `bottom-nav.tsx:144-145` usa `bg-[color-mix(in_oklch,var(--brand-store)_30%,white)]` — vibrante, depende de browser support pra `color-mix` (Safari 16.4+). MVP pop com fallback nulo.

**Achados:**

- 🟡 ADR-0011 diz "uso restrito a bottom-nav e badge da sacola" mas `hero-card`/`product-grid`/`category-strip`/`promo-strip` pegam brand-store também. Atualizar ADR ou afastar uso.
- 🟡 `store-shell.tsx:42-44` comenta "shadcn Portal — overlays devem re-injetar brandStyle". `sacola-drawer.tsx:91` e `categories-sidebar.tsx:112` re-injetam corretamente. Tooltip/Popover de outros components não verificado.
- 🔵 `app/layout.tsx:45` themeColor hardcoded `#1E3FE6` (azul Vitrê fixo). Quando user instala como PWA, theme bar fica azul Vitrê mesmo na loja Sandra. Edge case.

---

## Parte B — Repo Health

### B.1 Dead code

**Achados de alta confiança (0 referências externas):**

- 🔴 **`src/components/storefront/banner-carousel.tsx`** (263 linhas) — `BannerCarousel`/`PlaceholderBanner` não importados em nenhum lugar (Grep `BannerCarousel|banner-carousel` retornou só o próprio arquivo, `loading.tsx` usa Skeleton, e `skeletons.tsx` usa só o nome do skeleton). Home usa `HeroCard` (`page.tsx:21`).
- 🟠 **`src/components/storefront/categories-sidebar.tsx` export `useCategoriesSidebarTrigger`** (linhas 53-61) — define o hook mas nenhum consumer (Grep retornou só o próprio arquivo). O comentário em `store-shell.tsx:17` e `categories-sidebar.tsx:9` sugere que devia ser invocado no header/bottom-nav pra abrir a sidebar, mas nada chama. **Sidebar drawer existe mas sem trigger client** — funcionalmente morta no UI atual.
- 🟠 **`src/components/storefront/sacola-drawer.tsx` export `useSacolaDrawerTrigger`** (linhas 51-59) — nenhum consumer (Grep só o próprio arquivo). Drawer renderiza mas só abre por código (não consigo encontrar onde). Pode ser dead, ou pode estar quebrado.
- 🟠 **`src/components/storefront/toast.tsx` exports `useCartToast`/`useFavoriteToast`** — Grep só retorna a definição. Os componentes consumidores (`product-purchase-panel.tsx:71`) chamam `useToast()` direto + `addToast(...)`. As duas helpers são dead.
- 🟠 **`src/components/storefront/skeletons.tsx`** exports não-usados:
  - `BottomNavSkeleton` (linha 185) — sem consumer.
  - `HeaderSkeleton` (linha 167) — sem consumer.
  - `CartItemSkeleton` (linha 201) — sem consumer.
  - `FavoriteItemSkeleton` (linha 217) — sem consumer.
  - `BannerCarouselSkeleton` (linha 66) — usado em `loading.tsx` mas é skeleton de componente morto. Inconsistente: skeleton sem componente real.

### B.2 Deps

**`package.json` vs uso real:**

- 🟠 **`framer-motion ^12.38.0`** (linha 31) — 6 consumers: `favorite-button.tsx`, `toast.tsx`, `categories-sidebar.tsx`, `category-pills.tsx`, e em `(auth)/entrar/page.tsx` + `auth-card.tsx`. CLAUDE.md/team-memory diz **"sem framer-motion"** (`Bottom-nav: Sem Framer Motion — canvas usa CSS transitions puras (.2s)`). Conflito: o redesign canvas-v1 tirou em alguns places mas não em todos. Dep válida; pegada >100KB minified.
- 🟡 **`@supabase/supabase-js`** (linha 23) — usado só em `src/lib/supabase/server.ts`. Vai bem.
- 🟡 **`@supabase/ssr ^0.5.2`** (linha 22) — **0 consumers** em `src/` (Grep). Possivelmente dep órfã.
- 🟡 **`@tanstack/react-query ^5.83.0`** — usado **só em `src/providers/react-query.tsx`**. O `ReactQueryProvider` envolve toda a app no root layout, mas Grep `useQuery|useMutation` retornou 0 ocorrências reais (só import). O provider está montado mas ninguém usa hooks dele. Pode remover ou justificar (admin futuro).
- 🟡 **`radix-ui` (meta) ^1.4.3** — usado nos 14 arquivos `src/components/ui/*` (shadcn). OK.
- 🟢 `@upstash/ratelimit`/`@upstash/redis` — 1 consumer (`src/lib/rate-limit.ts`).
- 🟢 `nanoid` — 8 consumers.
- 🟢 `slugify` — 1 consumer (`src/lib/slug.ts`).
- 🟢 `libphonenumber-js` — 1 consumer (`whatsapp-format.ts`).
- 🟢 `react-number-format` — 2 consumers.
- 🟢 `better-auth` — 3 consumers.
- 🟢 `resend` — 1 consumer (`src/lib/email.ts`).
- 🟢 `sharp` — provavelmente em `src/lib/supabase/storage.ts` (não verificado linha-a-linha mas escopo bate).
- 🟢 `drizzle-orm`/`pg` — usado intensivamente.

**Drift CLAUDE.md vs `package.json`:**

- 🟠 CLAUDE.md (linha "Stack > UI") lista **`lottie-react`** mas `package.json` **não** tem. Grep também não encontrou import (`from 'lottie-react'`). Driftado — CLAUDE.md deve remover.
- 🟢 `tw-animate-css` (devDep) — usado em `globals.css:2` via `@import "tw-animate-css"`. OK.
- 🟢 `prettier-plugin-tailwindcss` — config plugin, não importado.
- 🟢 `@types/pg` — types-only.

### B.3 Env vars

`src/lib/env.ts:11-42` — validação Zod cobre:
- App: `NEXT_PUBLIC_APP_URL`, `NODE_ENV`
- DB: `DATABASE_URL`, `DIRECT_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auth: `BETTER_AUTH_SECRET` (min 32), `GOOGLE_CLIENT_ID`/`SECRET` (optional)
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Cron: `CRON_SECRET` (min 16)

`.env.example` lista todos os mesmos. Zero drift. **Excelente.**

- 🔵 Falta `BETTER_AUTH_URL` documentado como ausente intencionalmente (memória menciona isso) — `.env.example` não comenta. Adicionar nota.

### B.4 Configs

- 🟢 `next.config.ts` — CSP forte, HSTS preload, X-Frame-Options DENY, Permissions-Policy bloqueando camera/mic/geo/FLoC. Trade-off `'unsafe-inline'` documentado.
- 🟢 `tsconfig.json` — target ES2017 (ver achado em §B.5), strict on, paths `@/*`, exclude `drizzle`.
- 🟢 `vercel.json` — 2 crons (keep-alive, expire-orders).
- 🟢 `drizzle.config.ts`/`eslint.config.mjs`/`postcss.config.mjs`/`components.json` — presentes.
- 🟠 `tsconfig.json:2` `"target": "ES2017"` — quebra `tests/expire-orders-cron.test.ts:159` regex flag `/v` que requer ES2018+. Build production passa porque o teste é Node-only (não compilado pelo Next), mas `tsc --noEmit` falha (ver `_tsc-output.log`).
- 🟠 `eslint.config.mjs` — só estende `next/core-web-vitals + next/typescript + simple-import-sort`. Sem regras pra: `react/jsx-key`, exhaustive-deps strict, no-console, etc. `next lint` ainda é o usado, mas Next 16 vai deprecar (`_build-output.log` warning).
- 🟡 `.prettierrc.json` (81 bytes) — verificar conteúdo; não inspecionado.

### B.5 Tests

8 arquivos em `tests/`: `admin-actions`, `cart-aggregation`, `expire-orders-cron`, `order-actions`, `public-order`, `restock`, `sql-policies`, `variant-selection`.

- 🟠 **`tests/expire-orders-cron.test.ts:159` quebra `tsc --noEmit`** com TS1501: "This regular expression flag is only available when targeting 'es2018' or later." (confirmado em `_tsc-output.log`). Conhecido na team-memory. Fix: bump tsconfig target → ES2018, ou trocar regex flag.
- 🟢 Os testes seguem padrão "static-analysis": leem `route.ts`/`schema.ts` com `fs.readFileSync` e validam invariantes estruturais. Sem `@testing-library/react` ou Vitest — pragmático.
- 🟡 Sem cobertura de UI (storefront, admin). Lighthouse não no CI.
- 🟡 Sem testes de loader storefront (cache key, RLS, error paths) — todos cobertos só indiretamente.

### B.6 Docs drift

**Comparando `docs/CONTEXT.md`, `docs/produto/roadmap.md`, `CLAUDE.md`, e commits/code:**

- 🟠 `docs/CONTEXT.md:3` diz "Atualizado: 2026-05-08 (após Fase 1.6)" e linha 11 diz "Fase concluída: 1.6 — pipeline checkout end-to-end". **CLAUDE.md diz "Fase 1.4 concluída"**. Conflito real: storefront PDP + sacola + sucesso + `/p/[token]` estão implementados (commits e código mostram), então CLAUDE.md está atrasado.
- 🟠 `docs/produto/roadmap.md:12-14` marca **Fase 1.5 + 1.6 ✅ concluídas** e Fase 1.7 (Deploy) pendente. Bate com CONTEXT.md, conflita com CLAUDE.md.
- 🟠 CLAUDE.md menciona **`lottie-react`** (linha "UI > lottie-react") mas dep sumiu (§B.2).
- 🟠 CLAUDE.md menciona em §A.5 que bottom-nav "Bottom nav com mais de 4 itens" é proibido — ok, atende, mas falta documentar que **o item Categorias deve abrir sidebar drawer, não navegar pra rota**. `store-shell.tsx:17` referência `useCategoriesSidebar()` que não existe (é `useCategoriesSidebarTrigger`).
- 🟠 Sem ADR pra **redesign canvas-v1** (Lote 1-4). Team-memory tem múltiplos posts referenciando, mas `docs/decisoes/` para no 0011. Decisão de "fonte = canvas-referencia.html, NÃO migration v2/" merece ADR.
- 🟠 Sem ADR (e CONTEXT.md não menciona) para **`/favoritos` + `/perfil`**. Contradizem ADR-0008. Ou faz ADR-0012 reabrindo, ou remove os arquivos.
- 🟡 `docs/CONTEXT.md:43` "Stack one-liner" menciona Lottie — outro vestígio do lottie-react fantasma.
- 🟡 Team-memory diz "Vitrê deps — pnpm é o package manager canônico (não npm)", mas `package.json:7-12` `scripts.dev/build/lint/test` chamam `next`/`tsx` diretamente (OK pro pnpm também), porém `CLAUDE.md` linha "Comandos comuns" usa `npm install`/`npm run *`. Drift entre memória e CLAUDE.md.
- 🟡 README.md presente (2.9KB) — não inspecionado nesta auditoria; provavelmente desatualizado também.

### B.7 Scripts

`package.json:6-19`:
- `dev`, `build`, `start`, `lint` — Next padrão.
- `test` — `tsx --test "tests/**/*.test.ts"` ✅ tests existem.
- `db:generate`, `db:migrate`, `db:push`, `db:studio` — drizzle-kit ✅.
- `db:check` → `scripts/check-db.ts` ✅ existe.
- `db:check-storage` → `scripts/check-storage.ts` ✅ existe.
- `db:apply` → `scripts/apply-sql.ts` ✅ existe.

**Outros scripts em `scripts/` sem npm script:**
- `db-audit.mjs`, `db-cleanup.mjs` (preservados conforme team-memory).
- `extract-canvas-tmp.cjs` (extração de canvas) — provavelmente one-shot mas presente.
- `seed-sandra-banner.cjs` — one-off.
- `migrations-backup-2026-05-10T14-57-41-674Z.json` — backup, provavelmente OK.

- 🔵 `seed-sandra-banner.cjs` e `extract-canvas-tmp.cjs` sem scripts npm — invocar por path manualmente. OK pra one-off.
- 🟡 CLAUDE.md linha "Comandos comuns" menciona `npm run db:seed` mas **não existe** no `package.json` — drift documentado.

---

## Achados por severidade

### 🔴 Críticos (bloqueiam deploy)

1. **Bottom-nav linka pra rota inexistente** — `bottom-nav.tsx:62` `/${storeSlug}/categoria` (sem slug). Glob confirma ausência de `categoria/page.tsx`. Click → 404 garantido. Fix: abrir sidebar drawer (consumir `useCategoriesSidebarTrigger`) OU criar `/categoria/page.tsx` listando categorias.
2. **`/favoritos` viola ADR-0008** — `favoritos/page.tsx` + `favorite-button.tsx` + `use-favorites` hook. CLAUDE.md proíbe explicitamente. Decisão: ADR-0012 reabrindo (com pelo menos uma fonte) OU deletar.
3. **`/perfil` viola ADR-0008 + tem links pra rotas inexistentes** — `perfil/page.tsx:41-67` lista "Meus Pedidos" → `/pedidos`, "Endereços" → `/enderecos`, "Ajuda" → `/ajuda`. Nenhuma rota existe (Glob). Decisão: deletar `/perfil` e redirecionar pra `/sobre`, ou converter em "info da loja" como `/sobre` (já existe — duplicação direta).
4. **PDP JSON-LD `availability` lógica invertida** — `produto/[productSlug]/page.tsx:80-84`. Promo em produto esgotado → InStock pro Google. Reordenar: checar `isOutOfStock` antes de `hasActivePromo`.

### 🟠 Altos (entram em Lote 5 ou ADR)

5. **`framer-motion` ainda usado em 6 arquivos** apesar de "stack sem framer-motion" em CLAUDE.md. Consumers: `favorite-button.tsx`, `toast.tsx`, `categories-sidebar.tsx`, `category-pills.tsx`, `(auth)/entrar/page.tsx`, `auth-card.tsx`. Ou remove ou documenta exceção.
6. **`banner-carousel.tsx` é dead code** (263 linhas, 0 consumers). Remover + também `BannerCarouselSkeleton` em `skeletons.tsx` + remover do `loading.tsx`.
7. **Sidebar drawer e Sacola drawer sem triggers ativos** — `useCategoriesSidebarTrigger` e `useSacolaDrawerTrigger` exportados mas zero consumers. Componentes renderizam no shell, abrem só por código privado. Quebra UX intencional (abrir sidebar nunca acontece via click).
8. **`/perfil` e `/sobre` redundantes** — Ambos servem "info da loja". Bottom-nav e nav levam ao path certo? Reconciliar.
9. **`@supabase/ssr` aparenta ser dep órfã** — 0 consumers em `src/`. Verificar `auth.ts` indireto; se nada, remover.
10. **`@tanstack/react-query` montado sem consumer** — Provider envolve toda app mas zero `useQuery`/`useMutation`. Remover provider ou justificar.
11. **`toast.tsx:83` usa `<img>` em vez de `next/image`** — lint warning ativo, deveria usar Image (toast mostra thumb de produto, ganha optimization).
12. **`tests/expire-orders-cron.test.ts:159` quebra `tsc --noEmit`** com TS1501. Bumpar `tsconfig.target` pra ES2018+ ou trocar a regex flag.
13. **PDP JSON-LD sem `sku`/`brand`/`gtin`** — Google Merchant exige. Não-fatal mas reduz Rich Results.
14. **`categories-sidebar.tsx aria-describedby={undefined}`** quebra a11y do shadcn Sheet (warning runtime + screen reader perde a description).
15. **Sticky CTA bottom em `/sacola` pode sobrepor teclado iOS Safari** — `position: fixed` + sem `visualViewport` listener.
16. **Sucesso com `?code` inválido cai em `notFound()`** — mensagem "código não encontrado" mais útil.
17. **Docs drift Fase 1.4 (CLAUDE.md) vs Fase 1.6 (CONTEXT.md, roadmap)** — CLAUDE.md está atrasado, atualizar pra refletir realidade pós-Lote 4 canvas-v1.
18. **ADR faltando pra redesign canvas-v1** — Lotes 1-4 mudaram estrutura visual e fonte de verdade (canvas-referencia.html). Merece ADR-0012 ou 0013.
19. **CLAUDE.md menciona `lottie-react` que sumiu** — drift, remover da stack listada.

### 🟡 Médios

20. ADR-0011 (brand-store restrito a bottom-nav+badge) está derrapando: `hero-card`, `product-grid`, `category-strip` usam brand-store. Atualizar ADR ou recolher.
21. SEO falta `rel="canonical"` em páginas paginadas (`?page=N`).
22. SEO falta OpenGraph customizado em `/sobre`, `/destaques`, `/novidades`, `/favoritos`, `/perfil`.
23. `/favoritos` devia ser `noindex` (dinâmico, sem valor SEO) — junto com decisão crítica #2.
24. `eslint.config.mjs` mínimo (só simple-import-sort + next defaults). Faltam regras stronger (exhaustive-deps strict, react-hooks/rules, accessibility plugin).
25. CSP `'unsafe-inline'` em script/style — comentário menciona "nonce roadmap". Tightening pré-deploy de produção pública.
26. Sem testes de UI ou loaders storefront (cache, RLS path).
27. `useCartToast`, `useFavoriteToast` exports não-usados em `toast.tsx`.
28. Skeletons não-usadas em `skeletons.tsx` (5 exports).
29. `tw-animate-css` import em `globals.css` — verificar se features realmente são consumidas.
30. `perfil/page.tsx` strings ASCII ("Enderecos", "Duvidas") sem acento.
31. `categories-sidebar.tsx` strings em inglês ("Browse categories", "All Products", "View all in {x}") — i18n drift.
32. CLAUDE.md menciona `npm run db:seed` que não existe no `package.json`.
33. CLAUDE.md usa `npm` mas team-memory diz pnpm é canônico.

### 🔵 Cosméticos

34. README.md provavelmente desatualizado (não inspecionado).
35. Token CSS `color-mix(in oklch)` sem fallback pra browsers pré-2023.
36. `app/layout.tsx` themeColor hardcoded `#1E3FE6` — em PWA da loja Sandra fica Vitrê azul.
37. PDP `openGraph.type = "website"` poderia ser `product`.
38. `STORE_CACHE_TAG` definido mas actions hard-codam string literal.

---

## Recomendações priorizadas

**Antes de qualquer deploy Fase 1.7:**

1. **Decidir fate de `/favoritos` e `/perfil`** (críticos #2 e #3) — ou ADR-0012 reabrindo formalmente, ou deletar `favoritos/page.tsx`, `perfil/page.tsx`, `favorite-button.tsx`, `use-favorites.ts`, e remover botões de favoritar dos cards. Recomendação pessoal: **deletar** (ADR-0008 foi enfático; reabrir só com sinal de mercado).
2. **Corrigir bottom-nav `Categorias`** (crítico #1) — escolha A: trocar `href` por um `<button onClick={openSidebar}>` consumindo `useCategoriesSidebarTrigger`. Escolha B: criar `categoria/page.tsx` listando todas as categorias. Recomendação: A (canvas-v1 mostra drawer).
3. **Fix JSON-LD availability** (crítico #4) — 4 linhas.
4. **Remover `banner-carousel.tsx` + `BannerCarouselSkeleton`** + atualizar `loading.tsx` pra usar `Skeleton` simples ou `HeroCard` skeleton.
5. **Decidir framer-motion**: remover dos 6 arquivos OU documentar exceção no ADR. Auth (`entrar`, `auth-card`) já está em produção; storefront é onde dá pra cortar (`toast`, `favorite-button`, `categories-sidebar`, `category-pills`).
6. **Bump `tsconfig.target` ES2017→ES2022** — destrava test e abre features modernas (`#privateFields`, `??=`, etc). Build production já passa porque Next compila à parte.
7. **Atualizar docs** (CLAUDE.md, CONTEXT.md, roadmap.md) — sincronizar fase real (pós-Lote 4 canvas-v1), tirar `lottie-react`, alinhar npm/pnpm.

**Backlog pós-deploy:**

8. ADR-0012 (ou 0013) documentando redesign canvas-v1 (fonte = canvas-referencia.html).
9. ADR-0011 reescrito ou retirado (brand-store agora usado em hero/grid/strip também).
10. Adicionar rel="canonical" em listagens paginadas.
11. Tightening CSP via nonces (remover `'unsafe-inline'` quando Next App Router suportar bem).
12. Auditar `@supabase/ssr` e `@tanstack/react-query` — remover se sem uso real.
13. PDP JSON-LD: adicionar `sku`/`brand`/`gtin13` quando schema ganhar campos.
14. Lighthouse mobile real ≥80 antes de marcar Fase 1.7 como done.
15. Considerar testes de UI mínimos (cart aggregation já tem; falta storefront loaders + checkout flow).

---

Fim do relatório.
