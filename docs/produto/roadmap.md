# Roadmap — do MVP ao deploy

Atualizado: 2026-05-07. Cada item é checkbox real (`- [x]` concluído / `- [ ]` pendente). Renderiza em GitHub e Obsidian.

| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação | ✅ concluída |
| 1.1 | Schema multi-tenant + RLS | ✅ concluída |
| 1.2 | Better Auth + onboarding lojista | ✅ concluída |
| 1.3 | Admin: CRUD produto + galeria + câmera + estoque + variantes | ✅ concluída |
| 1.4 | Admin: categoria + banner + promoção + configurações | ✅ concluída |
| 1.5 | Catálogo público + ISR + SEO | ✅ concluída |
| 1.6 | Carrinho + checkout WhatsApp + Lottie | ✅ concluída |
| 1.7 | Deploy Vercel + Supabase prod + Cron + seed Sandra | ⏳ pendente |
| 2 | Multi-tenant pleno (signup self-service, dashboard pedidos) | 🔮 futuro |
| 3 | Monetização Stripe (Vitrê cobra dos lojistas) | 🔮 futuro |
| 4+ | Diferenciação (cupom, frete, pontos, subdomínio) | 🔮 futuro |

---

## Fase 0 — Fundação ✅

- [x] Análise exaustiva do repo BEWEAR
- [x] Conselho 5 agentes sobre arquitetura SaaS
- [x] ADRs 0001-0007 (multi-tenant RLS, checkout WA, Storage, routing, free tier, rate limit, identidade visual)
- [x] Estrutura `docs/` (Obsidian-compatible)
- [x] `.gitignore` ajustado para Obsidian e legado
- [x] `CLAUDE.md` na raiz (memória contínua)
- [x] `docs/CONTEXT.md` (briefing rápido)
- [x] `docs/arquitetura-tecnica.md` (mestre, 19 seções)
- [x] Mover repo BEWEAR para `_legacy-bewear/`
- [x] Mover `logo vitrê/` → `public/brand/` (com-nome, icone-branco, logo-principal)
- [x] Mover `Approve.json` → `public/lottie/order-approved.json`
- [x] `package.json` limpo: remover Stripe/dotenv-prod, adicionar Supabase + Lottie + Upstash + Resend + libphonenumber-js + sharp + slugify + nanoid; rename `vitre`
- [x] `next.config.ts` limpo (apenas hostname `*.supabase.co`)
- [x] `drizzle.config.ts` configurado para `.env.local` + DIRECT_URL
- [x] `.env.example` documentado
- [x] `.env.local` preenchido (13/13 envs)
- [x] `vercel.json` com cron `/api/cron/keep-alive` 09:00
- [x] Estrutura `src/` reescrita (vazia com `.gitkeep`s)
- [x] Tokens de identidade visual em `src/app/globals.css` (vitre-50 a vitre-950)
- [x] `npm install` (504 pacotes, Next 15.5.16, Drizzle 0.45.2)
- [x] CVE crítico do Next 15.4.1 resolvido (bump para 15.5)
- [x] `tsconfig.json` excluindo `_legacy-bewear` e `drizzle`
- [x] Logo identificada (`#1E3FE6` azul royal vibrante)

## Fase 1.1 — Schema multi-tenant + RLS ✅

- [x] `src/db/schema/auth.ts` (Better Auth: user/session/account/verification + role)
- [x] `src/db/schema/store.ts` (storeTable + nicheEnum + indexes)
- [x] `src/db/schema/catalog.ts` (category, product, productImage, productVariant, banner)
- [x] `src/db/schema/order.ts` (order + orderItem snapshot + orderStatusEnum)
- [x] `src/db/schema/index.ts` (re-export)
- [x] `src/db/index.ts` (Drizzle client com pool max=1)
- [x] `src/lib/env.ts` (validação Zod das env vars)
- [x] `src/lib/tenant.ts` (`withTenant` + `withServiceRole`)
- [x] `src/lib/supabase/server.ts` (service_role client)
- [x] `supabase/sql/01_rls_setup.sql` (policies + DISABLE RLS Better Auth)
- [x] `scripts/check-db.ts` + comando `npm run db:check`
- [x] Drizzle migration gerada (`drizzle/0000_living_thor.sql`)
- [x] Migration aplicada no Supabase (`npm run db:migrate`) — 12 tabelas, 13 FKs, 13 indexes
- [x] RLS policies aplicadas (17 policies em 8 tabelas de domínio; 4 Better Auth tables com RLS desabilitada)
- [x] Upstash Redis validado (PING → PONG)
- [x] Resend API key validada
- [x] ADR-0001 atualizado com nuance honesta (RLS é 2ª linha; FORCE RLS é roadmap pós-MVP)

## Fase 1.2 — Better Auth + onboarding lojista ✅

### Bloco A — Fundação ✅ (concluído 2026-05-07)
- [x] `src/lib/utils.ts` (cn helper)
- [x] `src/lib/rate-limit.ts` (Upstash Redis + 4 limiters)
- [x] `src/lib/email.ts` (Resend + sendVerificationEmail + sendPasswordResetEmail; escape de URL + tratamento de erro Resend)
- [x] `src/lib/auth.ts` (Better Auth config; baseURL única via NEXT_PUBLIC_APP_URL; additionalFields.role sem `required`)
- [x] `src/lib/auth-client.ts` (createAuthClient)
- [x] `src/app/api/auth/[...all]/route.ts` (handler Next)
- [x] Typecheck `tsc --noEmit` limpo
- [x] Code review via `code-reviewer` agent (PASS COM RESSALVAS → 5 issues corrigidas)
- [x] Removido `BETTER_AUTH_URL` do env (single source of truth: NEXT_PUBLIC_APP_URL)

### Bloco B — shadcn/ui + tema Vitrê ✅ (concluído 2026-05-07)
- [x] `globals.css` populado manualmente (shadcn init travava em Tailwind v4)
- [x] Tokens Vitrê (vitre-50→950) + shadcn tokens (--primary aponta pra azul Vitrê em oklch fiel)
- [x] 17 componentes via `shadcn@latest add`: button, input, label, form, card, dialog, sonner, radio-group, select, separator, tabs, avatar, textarea, switch, skeleton, alert, dropdown-menu
- [x] `src/app/layout.tsx` (Geist sans/mono + Toaster + ReactQueryProvider + metadata + viewport sem maximumScale por WCAG)
- [x] `src/providers/react-query.tsx` (QueryClient com staleTime 30s, gcTime 5min)
- [x] `src/app/page.tsx` placeholder
- [x] Typecheck `tsc --noEmit` limpo
- [x] Code review via `code-reviewer` agent (PASS COM RESSALVAS → 4 issues corrigidas: primary oklch ajustado, useTheme removido do Sonner, button lg → 44px, viewport WCAG)

### Bloco C — Páginas auth ✅ (concluído 2026-05-07)
- [x] `src/actions/auth/schema.ts` (Zod single source — signUp, signIn, requestPasswordReset, resetPassword)
- [x] `src/actions/auth/_translate-error.ts` (mapping PT-BR + extractAuthErrorCode helper)
- [x] `src/actions/auth/sign-up.ts`, `sign-in.ts`, `request-password-reset.ts`, `reset-password.ts` (4 server actions com rate limit)
- [x] `src/lib/auth-server.ts` (`getSessionOrNull` com `cache()` + `requireSession`)
- [x] `src/components/auth/auth-card.tsx` (wrapper com logo Vitrê)
- [x] `src/app/(auth)/layout.tsx` + `entrar/`, `criar-loja/conta/`, `recuperar/`, `redefinir/`
- [x] `src/app/(admin)/admin/{layout,page,admin-placeholder}.tsx` (guard + boas-vindas + logout)
- [x] Code review via `code-reviewer` agent (PASS COM RESSALVAS → 4 fixes aplicados; 1 TODO Fase 2)
- [x] Anti-enumeração no `recuperar` (sempre `ok: true` mesmo se email não existir)
- [x] Auth tokens invalidados após uso (Better Auth default)
- [ ] TODO Fase 2: revogar outras sessões após reset password (segurança)

### Bloco D — Onboarding completo ✅ (concluído 2026-05-07)
- [x] `src/lib/slug.ts` (RESERVED_SLUGS expandido: 44 entries; generateSlug; isValidSlugFormat; validateSlugSync)
- [x] `src/lib/whatsapp-format.ts` (E.164 via libphonenumber-js)
- [x] `src/lib/niche-categories.ts` (5 nichos com categorias pré-populadas)
- [x] `src/lib/brand.ts` (8 cores curadas + isValidHexColor)
- [x] `src/lib/store-context.ts` (`getCurrentStore` com `cache()`)
- [x] `src/actions/store/schema.ts` (Zod com refine slug + WhatsApp + hex)
- [x] `src/actions/store/check-slug-availability.ts` (rate-limited, sliding window 60/min)
- [x] `src/actions/store/create-store.ts` (transação Drizzle: store + categorias atômicas)
- [x] `src/components/onboarding/color-picker.tsx` (paleta + custom hex)
- [x] `src/components/onboarding/slug-input.tsx` (debounced 500ms + last-request-wins via checkSeq ref)
- [x] `src/components/onboarding/whatsapp-input.tsx` (PatternFormat máscara BR)
- [x] `src/app/(auth)/criar-loja/identidade/page.tsx` (formulário ÚNICO, decisão sênior)
- [x] `src/app/(admin)/admin/{layout,page,admin-placeholder}.tsx` atualizados (guard sem-loja → redireciona; mostra link da loja)
- [x] Logo opcional pulado no MVP (lojista adiciona depois em configurações)
- [x] Code review via `code-reviewer` agent (PASS COM RESSALVAS → 4 fixes aplicados: useRef real, NEXT_PUBLIC_APP_URL para SSR-safe, rate-limit no checkSlug, validação de slug auto-derivado)

### Critério de aceitação 1.2 ✅
- [x] Schema completo, RLS aplicada, auth funcional, onboarding até `/admin`
- [ ] Validação manual com Sandra Brito Collection (Anderson testa quando o sistema estabilizar a memória pra rodar `npm run dev`)

## Fase 1.3 — Admin: CRUD produto ✅

### Bloco A — Fundação imagem + storage ✅ (concluído 2026-05-07)
- [x] Pipeline sharp: 800×800 WebP 75% (`src/lib/image.ts`)
- [x] Helpers Supabase Storage (`src/lib/supabase/storage.ts`) + 3 buckets via SQL
- [x] Server actions `uploadProductImage` + `deleteProductImage` com rate limit + transação `(productId, position)` única
- [x] Migration custom `0003_product_image_position_unique.sql` aplicada via `scripts/apply-sql.ts`

### Bloco B — Componentes admin produto ✅ (concluído 2026-05-07)
- [x] `src/components/admin/price-input.tsx` (máscara BRL via NumericFormat, armazena centavos)
- [x] `src/components/admin/stock-input.tsx` (Switch + Input numérico condicional, `inputMode=numeric`)
- [x] `src/components/admin/image-uploader.tsx` (galeria + preview otimista, fix de race em uploads múltiplos)
- [x] `src/components/admin/variant-editor.tsx` (acordeão; `useId` por linha; `aria-controls`)
- [x] `src/lib/id.ts` (helper `tempId()` com fallback pra rede sem HTTPS)
- [x] Code-review aplicado: 3 críticos + 5 importantes corrigidos

### Bloco C — Páginas admin produto ✅ (concluído 2026-05-07)
- [x] `src/app/(admin)/admin/layout.tsx` (AdminShell + requireSession + redirect)
- [x] `src/app/(admin)/admin/page.tsx` (home com WelcomeCard)
- [x] Shell admin (`Header` sticky + `BottomNav` iOS-safe + `UserMenu` dropdown)
- [x] `src/app/(admin)/admin/produtos/page.tsx` (lista mínima — filtros/paginação ficam pra C.2)
- [x] `src/app/(admin)/admin/produtos/novo/page.tsx` (server cria draft + redirect)
- [x] `src/app/(admin)/admin/produtos/[id]/editar/page.tsx`
- [x] `src/components/admin/product-form.tsx` (RHF + Zod + sticky save mobile)
- [x] `src/components/admin/delete-product-dialog.tsx` (AlertDialog 2-cliques)
- [x] `src/components/admin/product-publish-toggle.tsx` (optimistic state)
- [x] Server actions: `create-draft`, `update` (diff variantes em transação), `delete` (DB→storage best-effort), `toggle-active`
- [x] Helpers `src/lib/db-errors.ts` (unique violation tradução) + `src/lib/slug-uniqueness.ts` (sufixo `-2/-3/...`)
- [x] Rate limit bucket `mutation` (60/min)
- [x] Code-review aplicado: 3 críticos + 2 importantes corrigidos. 9 pré-requisitos cumpridos.

### Débitos do Bloco C (não-bloqueantes)
- [ ] **C.2**: filtros (busca + status) + paginação real na lista
- [ ] Aviso de "alterações não salvas" ao sair com `isDirty=true` (hoje sai sem aviso)
- [ ] Retry com backoff em race condition de slug-uniqueness (hoje só traduz mensagem)

### 4 Ondas estilo Fly ✅ (concluído 2026-05-07)
- [x] **Onda 1** — `AdminSidebar` desktop (tiles brand-tinted, footer com UserMenu) + `BottomNav` escuro `navy-950/95` + `MobileHeader` slim + main como card + `FormSection` em layout `[14rem 1fr]` estilo settings macOS
- [x] **Onda 2** — `saveAndCreateNext` action + botão "Salvar e adicionar outro" inline (só em draft) + contador "nesta série" sessionStorage + `submittingRef` anti-duplo-clique + reuso de draft órfão na rota `/novo`
- [x] **Onda 3** — `createCategory` action (slug uniqueness, 2 níveis, defesa em profundidade) + `CategoryDialog` reusável (max-h scroll, autoFocus) + `CategoryField` no ProductForm (Select agrupado + "+ Nova categoria" inline com auto-select)
- [x] **Onda 4** — `loading.tsx` (lista + editar) com `role=status aria-live=polite` + `prefetch` seletivo (sidebar/header/CTAs sim, cards da lista não pra não estourar 4G da Sandra)
- [x] Code-review aplicado: 5 críticos + 6 importantes + 3 nits corrigidos

## Fase 1.4 — Admin: categoria + banner + promoção + config ✅ (concluída 2026-05-07)

- [x] `src/app/(admin)/admin/categorias/page.tsx` (tree 2 níveis, create/update/delete/toggleActive/reorder, validação anti-cycle)
- [x] `src/app/(admin)/admin/banners/page.tsx` (upload + reorder + edit link + toggle + delete, max 10/loja)
- [x] Tela "Em promoção" via filtro `?promo=1` (chip no filter bar + WHERE com `now()` server-side) — sem rota dedicada por decisão pragmática
- [x] `src/app/(admin)/admin/configuracoes/page.tsx` (form único: nome/descrição/nicho/cor/whatsapp/endereço/instagram + upload logo/ícone single-slot)
- [x] `src/app/(admin)/admin/pedidos/page.tsx` (lista filtrável por status + busca shortCode + paginação)
- [x] `src/app/(admin)/admin/pedidos/[id]/page.tsx` (detalhe + transições de status validadas + deeplink WhatsApp pré-preenchido)
- [x] Dashboard `/admin` com 6 quick-action cards (counts paralelos via `Promise.all`, resolve UX mobile pra Categorias/Banners que são `desktopOnly` no nav)
- [x] Server actions: CRUD category/banner + updateStoreConfig + updateOrderStatus
- [x] Zod schemas em `actions/{store,banner,category,order}/schema.ts`
- [x] Build production limpo (16 páginas)

## Fase 1.5 — Catálogo público + ISR + SEO ✅ (concluída 2026-05-08)

UX completa decidida em [ADR-0008](../decisoes/0008-ux-catalogo-publico-storefront.md). Estratégia de execução fixada via conselho-5-agentes: 4 blocos lineares com code-review entre cada (Loaders → Shell → Rotas críticas PDP-first → Busca/Sobre/Filtros/SEO).

### Bloco A — Data loaders públicos ✅ (commit `f0cb293`)
- [x] `src/lib/storefront/store-loader.ts` (`getStoreBySlug` cached + tag `store-${slug}`)
- [x] `src/lib/storefront/categories-loader.ts` (tree 2 níveis em memória + getCategoryBySlug)
- [x] `src/lib/storefront/products-loader.ts` (listProducts com filtros + getProductBySlug + getFeaturedProducts + getRecentProducts)
- [x] `src/lib/storefront/banners-loader.ts` (banners ativos ordenados)
- [x] `src/lib/storefront/search-loader.ts` (ILIKE escape + cap MAX_CACHEABLE_LENGTH)
- [x] `src/lib/storefront/_shared.ts` (helpers internos privados — attachPrimaryImage, ProductCardData, escapeIlikeTerm)
- [x] `src/lib/tenant.ts` exporta tipo `Tx` pra callers
- [x] Code-review aplicado (1 crítico + 4 importantes + 1 nit)

### Bloco B — Shell + brand color server-side ✅ (commit `8eb16e7`)
- [x] `src/app/(storefront)/[storeSlug]/layout.tsx` (RSC + generateMetadata + carrega categorias)
- [x] `src/app/(storefront)/[storeSlug]/not-found.tsx` (404 standalone)
- [x] `src/components/storefront/store-shell.tsx` (RSC; injeta `--primary` via inline style; skip link WCAG 2.4.1; envolve sidebar com brandStyle pra Portal)
- [x] `src/components/storefront/store-header.tsx` (sticky surface-elevated; hamburger + logo (next/image) + busca + carrinho com badge)
- [x] `src/components/storefront/bottom-nav.tsx` (surface-dark navy; 4 itens FIXOS Início/Categorias/Buscar/Sacola; iOS-safe; lg:hidden em desktop)
- [x] `src/components/storefront/categories-sidebar.tsx` (Sheet drill-down 2 níveis; provider + hook compartilhado entre header e bottom-nav; reset cleanup com useRef)
- [x] `src/components/storefront/store-footer.tsx` (RSC; info loja; "Powered by Vitrê" sutil)
- [x] Code-review aplicado (2 importantes — brandStyle no Sheet Portal + lg:hidden bottom-nav)

### Bloco C — Rotas críticas (PDP → home → categoria) ✅ (commit `86f6a0a`)
- [x] `src/app/(storefront)/[storeSlug]/produto/[productSlug]/page.tsx` (PDP + generateMetadata + JSON-LD Product com escape de `</script>` + 404)
- [x] `src/app/(storefront)/[storeSlug]/page.tsx` (home: banner + cat strip + Destaques + Novidades; LCP candidate único via AND)
- [x] `src/app/(storefront)/[storeSlug]/categoria/[categorySlug]/page.tsx` (lista paginada + breadcrumb)
- [x] `src/components/storefront/product-card.tsx` (RSC; foto + preço efetivo via pricing.ts + badge -XX% + Esgotado)
- [x] `src/components/storefront/product-grid.tsx` (RSC wrapper grid 2/3/4 col)
- [x] `src/components/storefront/product-gallery.tsx` (client; swipe scroll-snap + dots IntersectionObserver)
- [x] `src/components/storefront/product-purchase-panel.tsx` (client; variant selector + estoque dinâmico + CTA fixo bottom)
- [x] `src/components/storefront/banner-carousel.tsx` (client; mesmo padrão da gallery; aria-label por slide)
- [x] `src/components/storefront/category-strip.tsx` (RSC; scroll horizontal de chips)
- [x] `src/components/admin/pagination.tsx` movido pra `src/components/common/pagination.tsx` (compartilhado)
- [x] Code-review aplicado (2 críticos + 4 importantes — JSON-LD escape, buildHref="?", LCP eligibility AND, focus-visible variant)

### Bloco D — Busca, Sobre, Filtros, SEO ✅
- [x] `src/app/(storefront)/[storeSlug]/buscar/page.tsx` (form GET nativo; empty states distintos sem-termo vs nada-encontrado)
- [x] `src/app/(storefront)/[storeSlug]/sobre/page.tsx` (info da loja: descrição, contato, endereço, Maps; NÃO é perfil de cliente)
- [x] `src/components/storefront/filters-drawer.tsx` (Sheet direita; preço min/max + sort; URL como state; integrado em categoria)
- [x] `src/app/sitemap.ts` (gera URLs de todas as lojas/categorias/produtos ativos; revalidate 1h)
- [x] `src/app/robots.ts` (allow / + disallow /admin /api /criar-loja /entrar; aponta sitemap)
- [x] `generateMetadata` em todas as rotas dinâmicas
- [x] Performance: `next/image` em todas, Geist display=swap, priority único no LCP, scroll-snap nativo (sem libs), prefetch=false em descoberta

### Critério de aceitação 1.5 ✅
- [x] Storefront completo end-to-end (home + PDP + categoria + busca + sobre + 404)
- [x] Brand color por loja via `--primary` server-side
- [x] Sidebar drill-down 2 níveis + bottom-nav 4 itens (ADR-0008)
- [x] ZERO conta de cliente (carrinho localStorage chega na Fase 1.6)
- [x] ISR via `unstable_cache` + tag `store-${slug}` consistente em todos loaders
- [x] JSON-LD Product + sitemap.xml + robots.txt
- [x] Build production limpo (22/22 páginas)
- [ ] Lighthouse mobile ≥ 80 (rodar manualmente; 90+ é meta da Fase 1.7)

### Dívidas conhecidas (não bloqueantes)
- `attachPrimaryImage` carrega N×imagens em memória; migrar pra DISTINCT ON quando alguma loja chegar a milhares de produtos.
- Filtros de preço/sort não aplicam em `/buscar` (só em `/categoria`); estender se precisar.
- JSON-LD Product usa preço default; variantes específicas não vão pro Schema.org.
- Promo expira mid-session = preço cliente fica congelado (sessões curtas; aceitável).
- Lojista escolhendo hex muito claro pode quebrar contraste (paleta curada já mitiga).

## Fase 1.6 — Carrinho + checkout WhatsApp + Lottie ✅ (concluída 2026-05-08)

ADR-0010 escrita ANTES do código fixando 8 decisões (estrutura cart, captura mínima, server action atômica, mensagem WA, Lottie copy, markWhatsAppOpened fail-soft, /p/[code] sem dados pessoais, reset cart). 4 blocos lineares com code-review consolidado no fim.

### Bloco A — Carrinho client-side + idempotency_key ✅ (commit `cbb56b2`)
- [x] Migration `supabase/sql/03_order_idempotency.sql` (idempotency_key text not null + UNIQUE(storeId, idempotencyKey))
- [x] `src/db/schema/order.ts` atualizado (campo + index)
- [x] `src/lib/cart/types.ts` (CartState versionado v1)
- [x] `src/lib/cart/storage.ts` (read/write/clear com TTL 7d, falha graciosa)
- [x] `src/hooks/use-cart.tsx` (CartProvider context + hook; isHydrated flag pra evitar flash)
- [x] `StoreShell` envolvido com CartProvider
- [x] PDP CTA conectado ao addItem (toast "Adicionado à sacola")
- [x] Badge cart no header e bottom-nav

### Bloco B — SacolaDrawer + página /sacola
- [x] `src/components/storefront/sacola-drawer.tsx` (Sheet direita; provider compartilhado entre header e bottom-nav via context)
- [x] `src/app/(storefront)/[storeSlug]/sacola/page.tsx` (RSC wrapper + noindex)
- [x] `src/components/storefront/checkout-panel.tsx` (form react-hook-form + Zod, idempotencyKey via useRef no mount, layout 2-col desktop com resumo sticky, CTA fixo bottom mobile)
- [x] Header e bottom-nav abrem o drawer (não navegam direto pra /sacola)
- [x] `actions/order/schema.ts` estendido com customerInputSchema + cartItemInputSchema + createOrderInputSchema

### Bloco C — Server action + /sucesso + Lottie
- [x] `src/lib/shortcode.ts` (nanoid customAlphabet 32-chars sem ambíguos; 4 chars; ~14M combos)
- [x] `src/lib/whatsapp.ts` (buildOrderMessage com truncamento progressivo cap 1700 chars; buildWhatsAppUrl com encodeURIComponent)
- [x] `src/actions/order/create-from-cart.ts` (rate limit; resolução store via service_role; idempotency pre-check + try/catch UNIQUE; carregamento atômico produtos+variantes; estoque via fonte compartilhada; recálculo preço efetivo via pricing.ts; shortCode com retry 5x; transação Drizzle)
- [x] `src/lib/cart/stock.ts` (resolveStockState + isStockExhausted compartilhados client/server)
- [x] `src/app/(storefront)/[storeSlug]/sucesso/page.tsx` (resolve order via shortCode, valida vínculo com storeSlug, reconstroi whatsappUrl, noindex)
- [x] `src/components/storefront/order-lottie.tsx` (dynamic ssr:false + reduced-motion fallback CheckCircle2 + fetch resiliente)
- [x] `src/components/storefront/success-clear-cart.tsx` (limpa cart no client após mount)
- [x] CheckoutPanel redirect router.push("/sucesso?code=...") em result.ok

### Bloco D — Página pública + analytics + robots
- [x] `src/lib/storefront/order-loader.ts` (getOrderByShortCode via service_role)
- [x] `src/app/p/[token]/page.tsx` (público, noindex, brand color inline; mostra logo+itens+total+status+código; SEM nome/whatsapp/notes do cliente — rota migrada de `/p/[shortCode]` para `/p/[token]` no hardening P0 #2)
- [x] `src/actions/order/mark-whatsapp-opened.ts` (idempotente, rate limit publicApi, fail-soft)
- [x] `src/components/storefront/whatsapp-open-button.tsx` (Promise.race(action, 800ms timeout) — fix do bug de fetch cancelado por window.location.href síncrono)
- [x] `src/app/robots.ts` Disallow `/p/`

### Critério de aceitação 1.6 ✅
- [x] Pipeline end-to-end: PDP → Adicionar → drawer → /sacola → form → server action → /sucesso → WhatsApp → /p/[code]
- [x] Idempotency garantida (sem duplicatas em duplo-clique)
- [x] Server vence em recálculo de promo/preço/estoque
- [x] ZERO endereço/email persistido (LGPD-friendly; campo email REMOVIDO no review final)
- [x] Lottie copy honesto ("Pedido enviado · Sandra vai te chamar"; NÃO "aprovado")
- [x] /p/[code] sem dados pessoais do cliente
- [x] Reset cart imediato após sucesso
- [x] Build production limpo (25 páginas)

### Code-review consolidado A+B+C+D
- 2 Critical aplicados (email descartado silenciosamente removido; markWhatsAppOpened race com Promise.race+timeout)
- 1 Important aplicado (estoque atômico via lib/cart/stock.ts compartilhado)
- 2 Important documentados como dívida (string-match em error message Postgres; SELECT FOR UPDATE em estoque)

### Dívidas conhecidas (não bloqueantes)
- String-match em mensagem Postgres unique violation; usar `err.code === '23505'` + `err.constraint` quando refator.
- SELECT FOR UPDATE em validação de estoque pra fechar janela ~50-200ms entre SELECT e INSERT (Sandra <10 pedidos/dia, risco MVP zero).
- `markWhatsAppOpened` filtra por shortCode global, não por (storeId, shortCode).
- `customerNotes` em `rebuildMessageForExisting` usa request atual em vez de `existing.customerNotes` (race idempotency).

## Fase 1.7 — Deploy ⏳

- [x] Buckets Supabase Storage criados (com RLS policies) — 3 buckets (`store-logos`, `store-banners`, `product-images`) public, image/webp, 4MB. SQL versionado em `supabase/sql/02_storage_buckets.sql` (idempotente). Auditoria via `npm run db:check-storage`.
- [ ] Connection pooler validado (transaction mode em produção)
- [ ] `vercel link` + import GitHub
- [ ] Environment variables Vercel (todas as 13 envs do `.env.local` em `production`)
- [ ] Region `gru1` (São Paulo) configurada
- [ ] Deploy preview funcional
- [ ] Cron `/api/cron/keep-alive` rodando (verificar logs Vercel)
- [ ] Smoke test em produção:
  - [ ] `vitre-app.vercel.app/sandra-brito` carrega
  - [ ] Adicionar ao carrinho → finalizar WA → código curto correto
  - [ ] Login admin → criar produto via câmera mobile → upload OK
  - [ ] Pedido aparece em `/admin/pedidos`
- [ ] Lighthouse mobile no catálogo ≥ 90
- [ ] Sandra Brito recebe link funcional
- [ ] Seed Sandra com dados reais (após visita à loja)

---

## Fase 2 — Multi-tenant pleno 🔮

- [ ] Self-service signup completo (sem seed manual)
- [ ] Email verification ON (`requireEmailVerification: true`)
- [ ] Domínio próprio (`vitre.app` ou `.site`) + Resend domínio verificado
- [ ] Dashboard de pedidos com filtros avançados
- [ ] Notificações Resend (novo pedido pra lojista)
- [ ] FORCE RLS + role custom `vitre_app`
- [ ] Testes automatizados de isolamento de tenant

## Fase 3 — Monetização 🔮

- [ ] Vercel Hobby → Pro
- [ ] Plano Free com limite (X produtos / Y pedidos)
- [ ] Plano Pago via Stripe (mensalidade Vitrê)
- [ ] Métricas básicas pro lojista (visitas, conversão WA)
- [ ] `runbooks/migracao-free-para-pro.md`

## Fase 4+ — Diferenciação 🔮

- [ ] Cupom de desconto
- [ ] Frete grátis acima de X
- [ ] Programa de pontos
- [ ] Integração Correios
- [ ] Subdomínio próprio (`sandra.vitre.com.br`)
- [ ] App nativo via Capacitor
- [ ] Dark mode no admin
