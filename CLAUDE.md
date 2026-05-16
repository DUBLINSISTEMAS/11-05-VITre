# Vitrê — Briefing técnico

SaaS multi-tenant de **gestão para lojas de pequeno e médio porte**: catálogo digital, venda balcão (PDV), cadastro de clientes, estoque com movimentações e relatórios — com checkout do catálogo via WhatsApp. Sem gateway de pagamento próprio. Pivô formalizado em [ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md) (2026-05-15) — antes disso o produto era "catálogo digital + checkout WhatsApp"; o histórico do MVP continua válido como base.

> Este arquivo é lido automaticamente em cada sessão. Mantenha enxuto. Detalhes vivem em `docs/`.

## Estado atual

- **Pivô em curso**: Vitrê deixou de ser apenas catálogo e virou sistema de gestão da loja ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md)). Storefront público + admin CRUD + checkout WhatsApp permanecem **intactos**. Adicionando 6 módulos novos em ordem causal: pagamento configurável → clientes → estoque event-sourced → PDV balcão → relatórios → empacotamento desktop. Cada módulo tem ADR próprio antes do código.
- **Próxima fase**: **Fase 3 — cadastro de clientes** (ADR-0014 em curso 2026-05-16). Adiciona tabela `customer` (CRUD admin, sem login, sem exposição no storefront — ver ADR-0014 pra distinção formal vs ADR-0008), rota `/admin/clientes`, e coluna nullable `customer_id` em `orderTable` para vincular pedidos a clientes cadastrados.
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

- **Cor primária Vitrê**: `#1E3FE6` (azul royal vibrante — extraído da logo principal). Token: `--brand` (fixo).
- **Tipografia**: Geist (sans) + Geist Mono.
- **Pegada**: minimalista profissional, neutros frios (paleta `navy-*`), surfaces translúcidas, sombras tintadas (estilo Fly.io).
- **Token shadcn `--primary`**: lê de `--brand` por padrão; sobrescrito no storefront via `<BrandProvider color={store.primaryColor}>`.
- **Variant `hocus:`**: estados hover + focus-visible juntos (use `hocus:bg-accent/10`).
- **Utilities**: `bg-brand`, `bg-navy-{50..950}`, `shadow-brand-{sm,md,lg}`, `surface-base`, `surface-elevated`, `surface-dark`.
- Detalhes em [ADR-0007](docs/decisoes/0007-identidade-visual-vitre.md) (cor) e [ADR-0009](docs/decisoes/0009-design-system-tokens-navy.md) (tokens navy + sistema dual).

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
- ❌ Bottom nav do storefront com mais de 4 itens. ADR-0008 fixou: Home · Categorias · Buscar · Sacola.
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

- **Pivô para Vitrê Gestão (guarda-chuva das fases 2–6)**: [`docs/decisoes/0012-pivot-vitre-gestao.md`](docs/decisoes/0012-pivot-vitre-gestao.md)
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