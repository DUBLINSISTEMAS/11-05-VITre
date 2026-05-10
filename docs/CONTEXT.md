# Vitrê — Contexto rápido (briefing de 1 minuto)

Atualizado: 2026-05-10 (após Auditoria pré-deploy 7 ondas).

## Em uma frase

SaaS multi-tenant de catálogo digital com checkout via WhatsApp para lojas pequenas/médias, custo operacional R$ 0/mês no MVP, primeiro tenant é a Sandra Brito Collection.

## Estado

- **Fase concluída**: 1.6 — pipeline checkout end-to-end. PDP → Adicionar → drawer → /sacola (form mínimo nome+WA) → server action atômica (idempotency, validação estoque, recálculo preço) → /sucesso (Lottie + copy honesto) → WhatsApp pré-preenchido → /p/[token] pública (sem dados pessoais).
- **Redesign canvas-v1**: Lotes 1–4 ✅ aplicados (storefront `396e7c3` + admin `8f3c677`/`214ef26` + onboarding `4eb4b79`).
- **Auditoria pré-deploy 2026-05-10** ✅ fechada — 7 ondas (UX Sandra, RLS-ready, decisões produto, framer-motion→CSS, DB hardening incremental, repo health, verificação). 5 relatórios em `docs/sessoes/2026-05-10-auditoria-completa/`. Sem reset de DB — base estruturalmente sólida.
- **Próxima**: 1.7 — deploy Vercel + buckets prod + cron keep-alive + seed Sandra real + Lighthouse mobile real ≥80. Última fase do MVP. Lote 5+ canvas reservado pós-deploy.
- **Tier**: Supabase Free + Vercel Hobby + Resend Free + Upstash Free
- **Provisionado**: Supabase `zwbkzkyunbmoihcbeztm` em sa-east-1, Upstash `optimal-llama-117627`, Resend ativo
- **Estimativa restante Fase 1**: ~6h (deploy + cron + seed + smoke test)

## 5 pilares arquiteturais

1. **Multi-tenancy via Postgres RLS** — `store_id` em tudo, `withTenant()` em toda query. [ADR-0001](decisoes/0001-multi-tenant-rls-postgres.md).
2. **Catálogo público sem login** — carrinho em `localStorage`. Better Auth só no `/admin`. **Reafirmado em** [ADR-0008](decisoes/0008-ux-catalogo-publico-storefront.md).
3. **Checkout WhatsApp com código curto** — pedido gravado server-side antes do redirect. [ADR-0002](decisoes/0002-checkout-whatsapp-codigo-curto.md).
4. **Storage Supabase + Vercel Image** — imagens 800×800 WebP 75%, max 5/produto. [ADR-0003](decisoes/0003-supabase-storage-imagens.md).
5. **Rate limit Upstash** — endpoints sensíveis protegidos desde a fundação. [ADR-0006](decisoes/0006-rate-limit-upstash.md).

## UX do storefront (decidido 2026-05-07, [ADR-0008](decisoes/0008-ux-catalogo-publico-storefront.md))

- Sidebar drill-down lateral (raiz → subcategorias → back arrow)
- Bottom nav fixo de **4 itens** (Home · Categorias · Buscar · Sacola). NUNCA 5.
- Busca global em rota dedicada
- Listagem com filtros (preço, ordenação) em drawer
- Carrinho `Sheet` da direita
- Página `/sobre` com info da loja (não confundir com perfil de cliente — não existe)

## Identidade visual

- Cor primária: `#1E3FE6` (azul royal da logo)
- Tipografia: Geist
- Pegada: minimalista, mobile-first
- Detalhes: [ADR-0007](decisoes/0007-identidade-visual-vitre.md)

## Stack one-liner

Next 15 + Drizzle + Supabase Postgres/Storage + Better Auth + shadcn/ui + Tailwind v4 + TanStack Query + Zod + Resend + Upstash + sharp + Lottie. Hospedagem Vercel.

## Constraints viraram design (não são bug)

- Max 5 imagens por produto (free tier storage)
- Cron diário pingando o banco (anti auto-pause Supabase Free)
- Connection pool obrigatório (`?pgbouncer=true&connection_limit=1`)
- Vercel Cron 1x/dia 09:00 (`/api/cron/keep-alive`)

## Quando migrar pra paid

| Trigger | Migrar |
|---|---|
| Storage > 800 MB | Supabase Pro ($25/mês) |
| DB > 400 MB | Supabase Pro |
| Começar a cobrar dos lojistas | Vercel Pro (ToS) |
| > 2.500 emails/mês | Resend paid |
| > 8k Upstash commands/dia | Upstash Pay-as-you-go |

## Próximas decisões já tomadas (não revisitar sem contexto novo)

- Path-based routing (`/[storeSlug]`), subdomínio só na Fase 4+ — [ADR-0004](decisoes/0004-routing-path-based.md).
- Better Auth no admin, sem auth no storefront.
- `productImage` é tabela separada (galeria com ordem), não array.
- `orderItem` snapshota produto/variante (sobrevive a delete).
- Slug é único POR LOJA, não global (UNIQUE(storeId, slug)).

## O que está pendente (Fase 1, ordem de execução)

1. ~~Schema + RLS migrations~~ ✅
2. ~~Better Auth + reset password Resend~~ ✅
3. ~~Onboarding 5 telas~~ ✅
4. ~~CRUD produto + galeria + câmera~~ ✅
5. ~~CRUD categoria + banner + promo + config + lista de pedidos~~ ✅
6. ~~Catálogo público + ISR + SEO~~ ✅
7. ~~Carrinho + checkout WhatsApp + Lottie~~ ✅
8. ~~Redesign canvas-v1 (Lotes 1–4)~~ ✅
9. ~~Auditoria pré-deploy 2026-05-10 (7 ondas)~~ ✅
10. **Deploy Vercel + Cron + seed Sandra (6h)** ← próximo

## Documento mestre

[`arquitetura-tecnica.md`](arquitetura-tecnica.md) — schema completo, fluxos, deploy, runbooks. Quando esse `CONTEXT.md` ficar curto, é lá que detalha.
