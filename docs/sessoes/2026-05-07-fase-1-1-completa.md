# 2026-05-07 — Fase 1.1 fechada

Schema multi-tenant + RLS aplicados em produção (Supabase Free).

## O que foi entregue

### Schema TS (Drizzle)
- `src/db/schema/auth.ts` — Better Auth (user/session/account/verification + role)
- `src/db/schema/store.ts` — `storeTable` + `nicheEnum` + `store_owner_idx`
- `src/db/schema/catalog.ts` — category, product, productImage, productVariant, banner
- `src/db/schema/order.ts` — order + orderItem (snapshot) + orderStatusEnum
- `src/db/schema/index.ts` — re-export

### Helpers
- `src/db/index.ts` — Drizzle client (pool max=1)
- `src/lib/env.ts` — validação Zod das env vars
- `src/lib/tenant.ts` — `withTenant()` + `withServiceRole()`
- `src/lib/supabase/server.ts` — service_role client

### Infra
- `drizzle/0000_living_thor.sql` — migration gerada
- `supabase/sql/01_rls_setup.sql` — RLS policies (DISABLE em Better Auth + 17 policies em domain tables)
- `scripts/check-db.ts` — health check; comando `npm run db:check`
- `package.json` — scripts `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed`, `db:check`

## Aplicado em produção (Supabase `zwbkzkyunbmoihcbeztm` em sa-east-1)

- 12 tabelas
- 2 enums de domínio (`niche`, `order_status`)
- 13 FKs com `onDelete cascade` (ou `set null` em product.category_id)
- 13 indexes (incluindo composite `(store_id, slug)` UNIQUE em category e product)
- RLS desabilitada em `user`, `session`, `account`, `verification`
- 17 policies aplicadas (isolamento por tenant + leitura pública das ativas)

## Validações automáticas

- ✅ `npm run db:check` confirma 12 tabelas, 8 com policies
- ✅ Upstash Redis respondeu `PONG`
- ✅ Resend API key validada (`/domains` retornou `200`)

## Decisões arquiteturais cimentadas

- **RLS é 2ª linha de defesa**, não 1ª. Conexão via Drizzle usa role `postgres` que bypassa RLS por default. ADR-0001 atualizado com essa nuance honesta. App-layer (`withTenant`) é a primeira disciplina obrigatória. FORCE RLS com role custom é dívida planejada para Fase 2+.
- **Better Auth tables sem RLS** — Better Auth gerencia auth internamente. RLS apenas atrapalharia.
- **Connection pooling**: `DATABASE_URL` no pooler (porta 6543) com `?pgbouncer=true&connection_limit=1`; `DIRECT_URL` na 5432 só para migrations.
- **drizzle.config.ts** carrega `.env.local` explicitamente (default do `dotenv` é apenas `.env`).

## Aprendizados

- A opção "Enable automatic RLS" do Supabase é útil — defende em profundidade. Mantemos ligada.
- Better Auth 1.6.9 quer `drizzle-orm ^0.45.2` — bumpamos. Não usar `--legacy-peer-deps` é decisão correta.
- Next 15.4.1 tinha CVE crítico (CVE-2025-66478). Resolvido com bump para 15.5.16.

## Próximo passo

[Fase 1.2 — Better Auth + onboarding lojista](../produto/roadmap.md#fase-12--better-auth--onboarding-lojista). Plano detalhado em [memória `project_fase_1_2_plano`](https://obsidian.md "vault local").
