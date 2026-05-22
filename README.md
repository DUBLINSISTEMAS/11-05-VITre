# Mangos Pay

SaaS multi-tenant de loja online com checkout WhatsApp para lojas de pequeno e médio porte (roupa, joia, semijoia, perfumaria).

> **Estado atual**: Fase 1.6 (carrinho + checkout WhatsApp) concluída. Próximo: storefront público polido + multi-loja.
> **Cliente piloto**: Sandra Brito Collection (Pedreiras-MA).

## Stack

Next.js 15 · React 19 · TypeScript · Drizzle ORM · Supabase Postgres · Better Auth · Supabase Storage · TanStack Query · shadcn/ui · Tailwind v4 · Zod · Resend · Upstash Redis (rate limit) · Lottie · sharp · Vercel.

## Como rodar localmente

```bash
# 1. Copiar template e preencher
cp .env.example .env.local

# 2. Instalar deps
npm install

# 3. Aplicar schema no Supabase
npm run db:push

# 4. Subir
npm run dev
```

Abre em `http://localhost:3000`.

## Documentação

- 📐 **Arquitetura completa**: [`docs/arquitetura-tecnica.md`](docs/arquitetura-tecnica.md)
- 📌 **Briefing rápido**: [`docs/CONTEXT.md`](docs/CONTEXT.md)
- 🗺 **Roadmap**: [`docs/produto/roadmap.md`](docs/produto/roadmap.md)
- 🧠 **Decisões (ADRs)**: [`docs/decisoes/`](docs/decisoes/)
- 📋 **Glossário**: [`docs/glossario.md`](docs/glossario.md)
- ⚙️ **Briefing técnico** (Claude Code): [`CLAUDE.md`](CLAUDE.md)

## Estrutura

```
mangos-pay/
├── docs/                   ← documentação técnica (Obsidian-compatible)
├── public/
│   ├── brand/              ← logos do Mangos Pay
│   └── lottie/             ← order-approved.json
├── scripts/                ← health checks e utilitários (db:check, db:apply)
├── src/
│   ├── app/                ← App Router (admin, storefront, auth, marketing)
│   ├── actions/            ← server actions (auth, banner, category, order, product, store)
│   ├── components/         ← UI (ui/, admin/, storefront/, auth/, onboarding/, common/)
│   ├── db/                 ← Drizzle schema (auth, store, catalog, order)
│   ├── hooks/              ← hooks compartilhados (use-cart)
│   ├── lib/                ← auth, supabase, tenant, rate-limit, pricing, etc.
│   └── providers/          ← React Query, etc.
├── drizzle/                ← migrations geradas
├── supabase/sql/           ← scripts SQL (RLS, buckets, custom)
├── CLAUDE.md
└── package.json
```

## Comandos

```bash
npm run dev              # localhost:3000
npm run build            # build de produção
npm run lint
npm run test             # testes unitários/source checks
npm run test:integration # testes reais com credenciais (ver seção abaixo)
npm run db:generate      # Drizzle gera migration
npm run db:migrate       # aplica via DIRECT_URL
npm run db:push          # alternativa rápida (dev only)
npm run db:studio        # Drizzle Studio
npm run db:check         # health check do schema
npm run db:check-storage # health check dos buckets
npm run db:check-anon    # valida que anon não lê tabelas sensíveis
npm run db:apply <file>  # aplica SQL custom (ex: supabase/sql/04_*.sql)
```

## Testes de integração reais

Os testes em `tests/integration/` conectam no Supabase real usando
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` da `.env.local`.
Eles ficam pulados por padrão para não depender de rede/credenciais no CI local.

Rode manualmente antes de deploy e sempre que alterar RLS, grants ou policies:

```powershell
$env:RUN_INTEGRATION = "1"
pnpm test:integration
Remove-Item Env:RUN_INTEGRATION
```

Para o caso crítico de grants públicos, rode também:

```bash
pnpm db:check-anon
```
