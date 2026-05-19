# Vitrê — Briefing técnico

SaaS multi-tenant de **gestão para lojas de pequeno e médio porte**: catálogo digital, venda balcão (PDV), cadastro de clientes, estoque com movimentações e relatórios — com checkout do catálogo via WhatsApp. Sem gateway de pagamento próprio. Pivô formalizado em [ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md) (2026-05-15) — antes disso o produto era "catálogo digital + checkout WhatsApp"; o histórico do MVP continua válido como base.

> Este arquivo é lido automaticamente em cada sessão. Mantenha enxuto. Detalhes vivem em `docs/`.

## Estado atual

- **NORTE ATUAL — Camada Comercial Vitrê ([ADR-0034](docs/decisoes/0034-camada-comercial-vitre.md), aceito 2026-05-19).** Após feedback de prospects ("amador, falta muita coisa") + screenshots GFIL na pasta `PAINEL REF/`, conselho-5-agentes diagnosticou gap funcional arquitetônico (sem custo, sem margem, sem GTIN, sem vendedor no order, sem pagamento dividido, sem livro caixa avulso, sem fornecedor, sem fiado). **7 camadas em ordem causal**: (1) Dado-fonte schema, (2) Cadastro produto refeito, (3) PDV refeito (multi-pagamento + PDF 80mm + orçamento), (4) Caixa de verdade (sangria/suprimento/pagar conta), (5) Gestão (relatórios + DRE), (6) Compras + Inventário, (7) Fiado/crediário. Régua: vocabulário do varejo BR > SaaS-EUA; densidade utilitária OK em gestão; nada amador.
- **Port Dublin v3 high-fidelity → PARKED** ([ADR-0019](docs/decisoes/0019-port-dublin-v3-bagy-style.md) marcado como suspenso). Ondas 0-5i fechadas em prod (`6079bec..e918e57`) entregaram tokens canônicos + sidebar 248px + login split + onboarding 4-passos — shell admin atual é a base SUFICIENTE pra Camada Comercial. As 44 telas pixel-perfect retomam quando ≥5 clientes pagantes pedirem (mesma régua do ADR-0033 fiscal). Brand admin navy `#1A3A8F` preservado; `--brand-store` por loja preservado (ADR-0011). Tokens canônicos hoje em `src/app/globals.css` + `tailwind.config.ts`. **Atenção a mapa antigo**: módulos "Atributos / Cupons / Grupos cliente / Equipe multi-user" citados no escopo original do ADR-0019 **JÁ FORAM IMPLEMENTADOS** sob ADR-0024 (Atributos) / ADR-0026 (Cupons) / ADR-0025 (Grupos) / ADR-0029 (Equipe). Só falta UI pixel-perfect, que é exatamente o trabalho parked.
- **Pivô em curso**: Vitrê deixou de ser apenas catálogo e virou sistema de gestão da loja ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md)). Storefront público + admin CRUD + checkout WhatsApp permanecem **intactos**. Adicionando 6 módulos novos em ordem causal: pagamento configurável → clientes → estoque event-sourced → PDV balcão → relatórios → empacotamento desktop. Cada módulo tem ADR próprio antes do código.
- **Fase 3 concluída em 2026-05-16** (commits `4c391b8` core + `29d8edf` vínculo cliente↔pedido). Tabela `customer` em prod com RLS tenant_isolation, CRUD admin completo em `/admin/clientes`, FK opcional `order.customer_id` (ON DELETE SET NULL preserva snapshots), combobox de vínculo no `OrderDetailDialog` + ação "criar cliente a partir deste pedido" com dedup automático por phone. ADR-0014 aceito.
- **Fase 4 concluída em 2026-05-16** (commit `074ca2e`). Tabela `stock_movement` em prod com RLS owner-only + INSERT anônimo restrito a sale/return de order. Trigger `sync_stock_cache_on_movement` atualiza `stock_quantity` em product/variant atomicamente. Backfill aplicado em prod (saldo `initial` preservado via DISABLE TRIGGER no SQL 25). `create-from-cart.ts` refatorado pra INSERT movement type=sale sob advisory lock (anti-oversell); `restock.ts` pra INSERT type=return. Action standalone `recordStockMovement` cobre manual_in/manual_out/adjustment. UI `/admin/estoque` com listagem URL-driven + filtros. ADR-0015 aceito. **Follow-up não-bloqueante**: dialog "lançar movimentação" no editor de produto (action existe, falta UX).
- **Fase 5 concluída em 2026-05-16** (ADR-0016 aceito). Tabela `order` estendida com `channel` enum (whatsapp/balcao), `payment_method` enum (cash/pix/debit/credit/other), `discount_in_cents`, `cash_received_in_cents`. Migration 0018 + SQL 26 (4 CHECK constraints) em prod. `customer_phone` e `expires_at` tornados nullable. Helper `recordSaleMovements` extraído + compartilhado entre checkout WhatsApp (Fase 4) e PDV. Action `createBalcaoSale` com advisory lock por entidade alvo, INSERT order channel=balcao status=fulfilled + stock_movement type=sale. UI `/admin/pdv` mobile-first com busca de produto debounced, carrinho client-side, combobox de cliente opcional, 4 botões de método pagamento, troco automático em dinheiro, desconto manual. Recibo `/admin/pdv/recibo/[token]` com `window.print()`. Filtro de canal em `/admin/pedidos` com badge "Balcão" no row. Sidebar nav com item PDV.
- **Fase 6 PWA concluída em 2026-05-16** (ADR-0017 aceito, Tauri vetado até dor concreta). `public/manifest.webmanifest` + `public/sw.js` (cache-first pra assets estáticos, HTML/RSC sempre fresh) + `public/icons/` (192/512 any + maskable gerados via `scripts/generate-pwa-icons.mjs`). Registro condicional em prod via `<PwaRegister />` no root layout. Adicionado também appleWebApp metadata. Tauri/empacotamento desktop nativo permanece vetado por custo (R$ 1.500/ano cert. Windows + sai do free tier) — só reabrir com dor concreta de ≥2 clientes pagantes.
- **Follow-ups Fase 4/5 entregues 2026-05-16**: dialog "Lançar movimentação" no editor de produto (`/admin/produtos/[id]` → menu de ações → modal); KPI cards em `/admin/estoque` (saldo atual + entradas/saídas/ajustes do mês via `loadStockKpis`); página `/admin/pdv/caixa` agrupando vendas balcão do dia por método de pagamento (loadBalcaoDaySummary + window.print); F-keys no PDV (F2=busca produto, F3=cliente, F4=finalizar, ESC=limpar com confirmação).
- **Suporte remoto**: ADR-0018 aceito — AnyDesk/RustDesk como runbook operacional, NÃO feature do produto. Sem WebRTC/co-browse no código.
- **Fase 1.7 (deploy)**: permanece pendente. Não bloqueia as fases 2+ — pode ser fechada antes, em paralelo ou depois. Recomendação técnica: fechar antes para que Sandra comece a usar o que já existe enquanto o resto é construído.
- **Roadmap das fases novas** (cada uma com ADR antes do código):
  - Fase 2 — pagamento configurável (ADR-0013)
  - Fase 3 — cadastro de clientes (ADR-0014)
  - Fase 4 — estoque event-sourced via `stock_movement` (ADR-0015)
  - Fase 5 — PDV / balcão (ADR-0016)
  - Fase 6 — empacotamento desktop, PWA primeiro, Tauri depois (ADR-0017)
- **Concluído (base do MVP catálogo)**: Fase 0 + 1.1 (schema + RLS) + 1.2 (auth + onboarding) + 1.3 (CRUD produto) + 1.4 (CRUD categoria/banner/config/pedidos) + 1.5 (storefront público + ISR + SEO) + 1.6 (carrinho localStorage + checkout WhatsApp + Lottie + /p/[token]) + Redesign canvas-v1 (commits `396e7c3` storefront, `8f3c677`+`214ef26` admin, `4eb4b79` onboarding) + Auditoria pré-deploy 2026-05-10 (commits `3ee5bc5`→`b58f46a`, 7 ondas: UX Sandra, RLS-ready, decisões produto, framer-motion→CSS, DB hardening, repo health, verificação).
- **DB hardening** (SQLs 11–14 aplicados em prod): index parcial `order_expires_awaiting`, CHECK E.164 + length, index `verification.identifier`, trigger anti-3-níveis em `category`.
- **Auditoria sênior 2026-05-12** — todos 5 críticos fechados (re-verificado 2026-05-16): #1/#3/#5 morreram com o revert modal→página do produto (commit 13/05); #2 cache `promoOnly` ganhou BYPASS em `products-loader.ts:224` ("Crítico C2 da auditoria"); #4 `withTenant("")` virou `OWNER_SCOPE_SENTINEL` em `store-context.ts:24`. Importantes/cosméticos da auditoria seguem abertos como backlog não-bloqueante. Doc original: `docs/sessoes/2026-05-12-auditoria-senior-pendencias.md`.
- **Cliente piloto**: [Sandra Brito Collection](docs/clientes/sandra-brito-collection.md), Pedreiras-MA. Ainda não pagante.
- **Hospedagem alvo (fases 2–5)**: Vercel Hobby + Supabase Free + Resend Free + Upstash Free. Custo operacional permanece R$ 0/mês.
- **Hospedagem na Fase 6 (desktop)**: PWA não muda custo. Tauri exige certificado de assinatura Windows (~R$ 1.500/ano) e bucket para updater — sai do free tier quando for a hora.
- **Serviços externos provisionados**: Supabase (zwbkzkyunbmoihcbeztm.supabase.co, sa-east-1), Upstash (optimal-llama-117627), Resend (key ativa, sem domínio próprio ainda).

## Stack

**Core**: Next 15 + React 19 + TypeScript · Drizzle ORM + Supabase Postgres · Better Auth (somente lojista) · Supabase Storage.

**UI**: shadcn/ui (new-york, neutral) + Tailwind v4 · TanStack Query · react-hook-form + Zod · Sonner · lottie-react.

**Infra & ops**: Vercel · Resend (email) · `@upstash/ratelimit` + `@upstash/redis` (rate limit) · Vercel Cron (keep-alive Supabase).

**Utils**: sharp (compressão imagem) · libphonenumber-js · slugify · nanoid.

**Futuro** (não instalar até o ADR correspondente): Tauri 2.x + tauri-cli (Fase 6) · Workbox para service worker PWA (Fase 6) · biblioteca de impressão de recibo para PDV (Fase 5, candidatos: `@react-pdf/renderer` ou impressão térmica direta via Tauri/Web Serial).

**NÃO usamos**: Stripe (só Fase 3 do roadmap original — mensalidade do SaaS, ainda não priorizada), Supabase Auth, Prisma, NextAuth, Electron (perdeu para Tauri por tamanho de bundle — decisão a formalizar em ADR-0017).

## Convenções obrigatórias

1. **RLS-first** — toda tabela de domínio carrega `store_id`; toda query de admin/storefront passa por `withTenant(storeId, userId, fn)`. Ver `src/lib/tenant.ts`. Vale também para tabelas novas das fases 2+ (`customer`, `stock_movement`, etc).
2. **Zod em todos os boundaries** — server actions, env vars, route handlers. Schema vive em `actions/*/schema.ts`, importado por client e server (single source of truth).
3. **Mutações server-only** — client nunca chama Drizzle. Sempre server action `"use server"`. Ações com prefixo `load*` (ex: `loadProductDetail`) são leituras async para dialogs client e **não** devem ter side-effects — convenção formalizada após auditoria 2026-05-12.
4. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
5. **Imagens** — sharp 800×800 WebP 75% ANTES do upload. Max 5 imagens/produto. Servidas via `next/image`.
6. **Rate limit** — endpoints sensíveis (auth, orders, upload) protegidos via `@upstash/ratelimit`. PDV da Fase 5 também: criar venda balcão entra no limiter de mutação.
7. **Slugs reservados** — ver lista em `src/lib/slug.ts`.
8. **Better Auth + Next 15 server actions** — plugin `nextCookies()` de `better-auth/next-js` é OBRIGATÓRIO no `auth.ts` (último item de `plugins`). Sem ele, `auth.api.signIn/signUp/etc` chamados de server actions parecem funcionar (retornam ok) mas a sessão NÃO persiste — cookie fica preso na Response interna. Sintomas: signup → "sessão expirada"; signin → toast OK mas fica em /entrar.
9. **Páginas client com `useSearchParams()` precisam `<Suspense>`** — Next 15 estoura no prerender estático sem boundary. Padrão: `export default function() { return <Suspense fallback={<Skeleton />}><ContentInner /></Suspense> }` onde `ContentInner` é quem chama o hook. Aplicado em `/entrar` e `/redefinir`.
10. **Promoção é inline no `productTable`** — não há tabela de promoção separada. `promoPriceInCents` + `promoStartsAt` + `promoEndsAt` definem promoção ativa por produto. Lógica de "ativa agora" centralizada em `src/lib/pricing.ts` (`hasActivePromo`, `getEffectivePrice`, `formatPriceLabel`). Sempre use esses helpers — não calcule promo direto. **Pagamento (Fase 2) seguirá o mesmo padrão**: colunas inline em `storeTable` para default + opcional override em `productTable`. NÃO criar tabela `payment_config` separada sem ADR justificando.
11. **Listas server-rendered usam URL como state** — filtros e paginação em `searchParams`. Padrão: server lê params async, monta WHERE dinâmico com array de `SQL` + `and(...)`, faz `count()` paralelo via `Promise.all`. Client component (filters) usa `useRouter().replace()` debounced 300ms pra busca textual. Implementado em `/admin/produtos` e `/admin/pedidos`. **Replicar em `/admin/clientes` (Fase 3), `/admin/estoque/movimentos` (Fase 4) e `/admin/vendas` (Fase 5)** — não inventar padrão novo.

## Identidade visual

- **Cor primária Vitrê** (port Dublin v3 em curso desde 2026-05-17): `#1A3A8F` navy BAGY-inspired (`--brand`). Hover `#14306F` (`--brand-2`). Wash `#EEF1FB` (`--brand-wash`), line `#C7D2EE` (`--brand-line`). Paleta legada `vitre-*` (50→950, primary `#1E3FE6`) **mantida pra marketing/emails/favicon/logo** — só admin/login/onboarding muda. Histórico do royal vibrante em [ADR-0007](docs/decisoes/0007-identidade-visual-vitre.md), nova decisão em [ADR-0019](docs/decisoes/0019-port-dublin-v3-bagy-style.md).
- **Tipografia**: Geist (sans) + Geist Mono via `next/font`.
- **Pegada**: BAGY-inspired (Stripe/Fly.io sério), sidebar branca 248px, surfaces neutras `--bg-app: #F5F6F8`, escala `--ink-1..5` (`#0F1419` → `#B5BAC2`), raios 12px cards / 8px botões.
- **Token shadcn `--primary`**: lê de `--brand` por padrão; sobrescrito no storefront via `<BrandProvider color={store.primaryColor}>` ([ADR-0011](docs/decisoes/0011-brand-color-restrita-bottom-nav-sacola.md) preservado).
- **Variant `hocus:`**: estados hover + focus-visible juntos (use `hocus:bg-accent/10`).
- **Utilities Dublin** (Onda 1+ do port): `b3-card`, `b3-pill-{ok,warn,danger,brand,gold,silver}`, `b3-tbl`, `b3-drawer`, `b3-helpbar`, `b3-stat`, `b3-tree` em `@layer components`.
- **Utilities legadas mantidas**: `bg-brand`, `bg-navy-{50..950}`, `shadow-brand-{sm,md,lg}`, `surface-base`, `surface-elevated`, `surface-dark`.
- Detalhes em [ADR-0019](docs/decisoes/0019-port-dublin-v3-bagy-style.md) (port em curso), [ADR-0007](docs/decisoes/0007-identidade-visual-vitre.md) (cor histórica, parcialmente substituído) e [ADR-0009](docs/decisoes/0009-design-system-tokens-navy.md) (sistema dual brand/primary, parcialmente substituído).

## Comandos comuns

```bash
npm install
npm run dev              # localhost:3000
npm run build            # production build
npm run lint
npm run db:generate      # Drizzle gera migration a partir do schema
npm run db:migrate       # aplica via DIRECT_URL (porta 5432)
npm run db:push          # alternativa rápida (dev only)
npm run db:studio        # Drizzle Studio
npm run db:seed          # popula Sandra Brito + placeholders
```

## O que NÃO fazer

- ❌ Adicionar Stripe ao checkout do catálogo (lojista vende pelo WhatsApp, ponto). PDV da Fase 5 também não processa cartão — apenas registra a forma de pagamento escolhida como metadado.
- ❌ **Cadastro/login/perfil/favoritos/histórico/foto/endereço de CLIENTE FINAL NO STOREFRONT** — wedge é "zero login no storefront". Reafirmado em [ADR-0008](docs/decisoes/0008-ux-catalogo-publico-storefront.md). Carrinho em localStorage. **Atenção:** [ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md) → [ADR-0014](docs/decisoes/0014-customer-admin-vs-storefront.md) introduz tabela `customer` cadastrável **pelo admin** (CRUD interno do lojista, sem login, sem exposição no storefront). Isso **não** viola esta regra — é categoria diferente. Storefront continua anônimo.
- ❌ Bottom nav do storefront com mais de 5 itens ([ADR-0032](docs/decisoes/0032-storefront-bottom-nav-5-tabs.md) ratificou override do ADR-0008). Lista canônica: Início · Categorias · Favoritos · Buscar · Sacola. Favoritos precisa continuar **localStorage-only** — qualquer tentativa de persistir favoritos em DB ou exigir login pra acessá-los exige novo ADR.
- ❌ Pular RLS "pra facilitar" — vazamento entre tenants é catastrófico. Vale também para `customer`, `stock_movement` e qualquer tabela nova das fases 2+.
- ❌ Subir imagens sem compressão.
- ❌ Fazer mutação sem `revalidateTag`.
- ❌ **Construir acesso remoto / captura de tela / controle remoto dentro do Vitrê.** Suporte remoto vive em runbook operacional (instalar AnyDesk ou RustDesk no cliente). Não é feature do produto. Ver ADR-0018 quando existir.
- ❌ **NF-e, SEFAZ, integração fiscal.** Fora do escopo do pivô — exige certificado digital, homologação por UF e suporte fiscal contínuo. Só revisitar em fase >6 com dor concreta de cliente pagante.
- ❌ **Electron.** Em Tauri se justifica. Decisão a formalizar em ADR-0017.
- ❌ **Sync offline-first robusto (CRDT, replicação bidirecional).** Fase 6 cobre PWA com cache de leitura. Sync real é 200-400h de engenharia — só com dor validada.
- ❌ Sugerir alternativas à stack escolhida sem problema concreto.
- ❌ Pular ADR antes do código quando a mudança é estrutural (schema novo, tabela nova, mudança de fluxo de pedido). Vale especialmente para as fases 2–6 — todas têm ADR antes.
- ❌ Criar arquivos de doc/planning sem o usuário pedir; mas mantenha `docs/` atualizado quando fizer mudanças arquiteturais.

## Onde encontrar tudo

- **Norte atual — Camada Comercial Vitrê (SoT do trabalho EM CURSO)**: [`docs/decisoes/0034-camada-comercial-vitre.md`](docs/decisoes/0034-camada-comercial-vitre.md). 7 camadas em ordem causal. Schema-first.
- **Veto fiscal explícito**: [`docs/decisoes/0033-veto-fiscal-explicito.md`](docs/decisoes/0033-veto-fiscal-explicito.md). Vitrê NÃO emite NF-e/NFC-e/SPED. NCM = texto livre pra futura integração Bling.
- **Port Dublin v3 (PARKED até ≥5 pagantes)**: [`docs/decisoes/0019-port-dublin-v3-bagy-style.md`](docs/decisoes/0019-port-dublin-v3-bagy-style.md). Tokens canônicos hoje em `src/app/globals.css` + `tailwind.config.ts`. Shell admin atual é base suficiente pra Camada Comercial.
- **Pivô para Vitrê Gestão (guarda-chuva)**: [`docs/decisoes/0012-pivot-vitre-gestao.md`](docs/decisoes/0012-pivot-vitre-gestao.md)
- **Arquitetura completa**: [`docs/arquitetura-tecnica.md`](docs/arquitetura-tecnica.md)
- **Briefing rápido**: [`docs/CONTEXT.md`](docs/CONTEXT.md)
- **Roadmap**: [`docs/produto/roadmap.md`](docs/produto/roadmap.md) — atualizar com fases novas conforme cada ADR for fechado.
- **ADRs (decisões)**: [`docs/decisoes/`](docs/decisoes/) — ordem cronológica: 0001–0011 (MVP catálogo), 0012+ (Vitrê Gestão).
- **Cliente piloto**: [`docs/clientes/sandra-brito-collection.md`](docs/clientes/sandra-brito-collection.md)
- **Glossário**: [`docs/glossario.md`](docs/glossario.md)
- **Auditoria sênior 2026-05-12** (pendências abertas): [`docs/sessoes/2026-05-12-auditoria-senior-pendencias.md`](docs/sessoes/2026-05-12-auditoria-senior-pendencias.md)

## Padrões de evolução

- Decisão arquitetural nova → ADR em `docs/decisoes/NNNN-titulo.md` (template em `docs/decisoes/template.md`). **Vale para toda fase 2+** — não começar código sem ADR fechado.
- Sessão importante → log em `docs/sessoes/YYYY-MM-DD-titulo.md`.
- Marco completado → atualizar `docs/CONTEXT.md` e este `CLAUDE.md` com novo estado.
- Fase nova iniciada → atualizar `docs/produto/roadmap.md` adicionando a checklist da fase.

## Ambiente

Windows 11 + PowerShell + VS Code + **Claude Code** (extensão / CLI). PT-BR. Repositório em `C:\Users\ANDERSON FELIPE\Documents\catálogo\`.

## Founder

Anderson Felipe — dev solo, comunica em PT-BR. Aplica `/conselho-5-agentes` em decisões substanciais. Quer abordagem de dev sênior, sem amadorismo. Confirma antes de operações destrutivas. Pivô do Vitrê para sistema de gestão da loja foi decisão consciente após apresentação a 2 prospects em maio/2026 — ver [ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md) para o racional completo.