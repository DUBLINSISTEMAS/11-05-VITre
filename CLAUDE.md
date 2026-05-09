# Vitrê — Briefing técnico

SaaS multi-tenant de catálogo digital com checkout via WhatsApp para lojas de pequeno/médio porte (roupa, joia, semijoia, perfumaria). Sem gateway de pagamento próprio.

> Este arquivo é lido automaticamente em cada sessão. Mantenha enxuto. Detalhes vivem em `docs/`.

## Estado atual

- **Fase**: Fase 1.4 concluída. **Admin completo end-to-end** (produtos + categorias + banners + configurações + pedidos). Próximo: **Fase 1.5** — storefront público (catálogo + ISR + SEO) + carrinho localStorage + checkout WhatsApp.
- **Concluído**: Fase 0 + Fase 1.1 (schema + RLS) + Fase 1.2 (auth + onboarding) + Fase 1.3 inteira (CRUD produto + 4 ondas Fly + C.2 filtros/paginação) + **Fase 1.4 inteira**: (a) CRUD categorias com tree 2-níveis (create/update/delete/toggleActive/reorder, edit dialog, validação anti-cycle e anti-3-níveis); (b) Configurações da loja (form único: nome/descrição/nicho/cor/whatsapp/endereço/instagram + upload logo/ícone single-slot com substituição); (c) CRUD banners (upload + reorder + edit link + toggle + delete, max 10/loja); (d) Tela "Em promoção" via filtro `?promo=1` (chip no filter bar + WHERE com `now()` server-side); (e) Lista de pedidos + detalhe (filtros status + busca shortCode + paginação + transições de status validadas + deeplink WhatsApp pré-preenchido); (f) Dashboard com 6 quick-action cards no `/admin` (counts paralelos via `Promise.all`, resolve UX mobile pra Categorias/Banners que são `desktopOnly` no nav). Build production limpo (16 páginas).
- **Cliente piloto**: [Sandra Brito Collection](docs/clientes/sandra-brito-collection.md), Pedreiras-MA
- **Hospedagem alvo**: Vercel Hobby + Supabase Free + Resend Free + Upstash Free
- **Custo operacional MVP**: R$ 0/mês
- **Serviços externos provisionados**: Supabase (zwbkzkyunbmoihcbeztm.supabase.co, sa-east-1), Upstash (optimal-llama-117627), Resend (key ativa, sem domínio próprio ainda)

## Stack

**Core**: Next 15 + React 19 + TypeScript · Drizzle ORM + Supabase Postgres · Better Auth (somente lojista) · Supabase Storage.

**UI**: shadcn/ui (new-york, neutral) + Tailwind v4 · TanStack Query · react-hook-form + Zod · Sonner · lottie-react.

**Infra & ops**: Vercel · Resend (email) · `@upstash/ratelimit` + `@upstash/redis` (rate limit) · Vercel Cron (keep-alive Supabase).

**Utils**: sharp (compressão imagem) · libphonenumber-js · slugify · nanoid.

**NÃO usamos**: Stripe (só Fase 3 — mensalidade do SaaS), Supabase Auth, Prisma, NextAuth.

## Convenções obrigatórias

1. **RLS-first** — toda tabela de domínio carrega `store_id`; toda query de admin/storefront passa por `withTenant(storeId, userId, fn)`. Ver `src/lib/tenant.ts`.
2. **Zod em todos os boundaries** — server actions, env vars, route handlers. Schema vive em `actions/*/schema.ts`, importado por client e server (single source of truth).
3. **Mutações server-only** — client nunca chama Drizzle. Sempre server action `"use server"`.
4. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
5. **Imagens** — sharp 800×800 WebP 75% ANTES do upload. Max 5 imagens/produto. Servidas via `next/image`.
6. **Rate limit** — endpoints sensíveis (auth, orders, upload) protegidos via `@upstash/ratelimit`.
7. **Slugs reservados** — ver lista em `src/lib/slug.ts`.
8. **Better Auth + Next 15 server actions** — plugin `nextCookies()` de `better-auth/next-js` é OBRIGATÓRIO no `auth.ts` (último item de `plugins`). Sem ele, `auth.api.signIn/signUp/etc` chamados de server actions parecem funcionar (retornam ok) mas a sessão NÃO persiste — cookie fica preso na Response interna. Sintomas: signup → "sessão expirada"; signin → toast OK mas fica em /entrar.
9. **Páginas client com `useSearchParams()` precisam `<Suspense>`** — Next 15 estoura no prerender estático sem boundary. Padrão: `export default function() { return <Suspense fallback={<Skeleton />}><ContentInner /></Suspense> }` onde `ContentInner` é quem chama o hook. Aplicado em `/entrar` e `/redefinir`.
10. **Promoção é inline no `productTable`** — não há tabela de promoção separada. `promoPriceInCents` + `promoStartsAt` + `promoEndsAt` definem promoção ativa por produto. Lógica de "ativa agora" centralizada em `src/lib/pricing.ts` (`hasActivePromo`, `getEffectivePrice`, `formatPriceLabel`). Sempre use esses helpers — não calcule promo direto.
11. **Listas server-rendered usam URL como state** — filtros e paginação em `searchParams`. Padrão: server lê params async, monta WHERE dinâmico com array de `SQL` + `and(...)`, faz `count()` paralelo via `Promise.all`. Client component (filters) usa `useRouter().replace()` debounced 300ms pra busca textual. Implementado em `/admin/produtos` e `/admin/pedidos`.

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

- ❌ Adicionar Stripe ao checkout do catálogo (lojista vende pelo WhatsApp, ponto).
- ❌ **Cadastro/login/perfil/favoritos/histórico/foto/endereço de CLIENTE FINAL** — wedge é "zero login no storefront". Reafirmado em [ADR-0008](docs/decisoes/0008-ux-catalogo-publico-storefront.md) (2026-05-07). Carrinho em localStorage. Reabrir só com ADR novo se 5+ lojistas pedirem após MVP no ar.
- ❌ Bottom nav com mais de 4 itens. ADR-0008 fixou: Home · Categorias · Buscar · Sacola.
- ❌ Pular RLS "pra facilitar" — vazamento entre tenants é catastrófico.
- ❌ Subir imagens sem compressão.
- ❌ Fazer mutação sem `revalidateTag`.
- ❌ Sugerir alternativas à stack escolhida sem problema concreto.
- ❌ Criar arquivos de doc/planning sem o usuário pedir; mas mantenha `docs/` atualizado quando fizer mudanças arquiteturais.

## Onde encontrar tudo

- **Arquitetura completa**: [`docs/arquitetura-tecnica.md`](docs/arquitetura-tecnica.md)
- **Briefing rápido**: [`docs/CONTEXT.md`](docs/CONTEXT.md)
- **Roadmap**: [`docs/produto/roadmap.md`](docs/produto/roadmap.md)
- **ADRs (decisões)**: [`docs/decisoes/`](docs/decisoes/)
- **Cliente piloto**: [`docs/clientes/sandra-brito-collection.md`](docs/clientes/sandra-brito-collection.md)
- **Glossário**: [`docs/glossario.md`](docs/glossario.md)

## Padrões de evolução

- Decisão arquitetural nova → ADR em `docs/decisoes/NNNN-titulo.md` (template em `docs/decisoes/template.md`).
- Sessão importante → log em `docs/sessoes/YYYY-MM-DD-titulo.md`.
- Marco completado → atualizar `docs/CONTEXT.md` com novo estado.

## Ambiente

Windows 11 + PowerShell + VSCode/Cursor. PT-BR. Repositório em `C:\Users\ANDERSON FELIPE\Documents\catálogo\`.

## Founder

Anderson Felipe — dev solo, comunica em PT-BR. Aplica `/conselho-5-agentes` em decisões substanciais. Quer abordagem de dev sênior. Confirma antes de operações destrutivas.
