# Vitrê — Arquitetura Técnica do MVP ao Deploy

Documento mestre. Descreve o sistema completo: stack, dados, aplicação, segurança, deploy, operações. Validado via Conselho-5-agentes em 2026-05-07.

---

## Índice

1. [Visão executiva](#1-visão-executiva)
2. [Validação via Conselho-5-agentes](#2-validação-via-conselho-5-agentes)
3. [Stack tecnológica](#3-stack-tecnológica)
4. [Constraints do tier free e gatilhos de migração](#4-constraints-do-tier-free-e-gatilhos-de-migração)
5. [Arquitetura de dados](#5-arquitetura-de-dados)
6. [Arquitetura da aplicação](#6-arquitetura-da-aplicação)
7. [Multi-tenancy operacional](#7-multi-tenancy-operacional)
8. [Auth (Better Auth + roles)](#8-auth-better-auth--roles)
9. [Storage (Supabase + sharp + Vercel Image)](#9-storage-supabase--sharp--vercel-image)
10. [Catálogo público](#10-catálogo-público)
11. [Painel admin](#11-painel-admin)
12. [Carrinho e checkout WhatsApp](#12-carrinho-e-checkout-whatsapp)
13. [Onboarding lojista](#13-onboarding-lojista)
14. [Variáveis de ambiente](#14-variáveis-de-ambiente)
15. [Plano de deploy](#15-plano-de-deploy)
16. [Operações](#16-operações)
17. [Critérios de aceitação Fase 1](#17-critérios-de-aceitação-fase-1)
18. [Riscos conhecidos e mitigação](#18-riscos-conhecidos-e-mitigação)

---

## 1. Visão executiva

Vitrê é SaaS multi-tenant de catálogo digital com checkout via WhatsApp, sem gateway de pagamento próprio. Cada lojista tem sua loja em `vitre.app/[storeSlug]`, gerencia produtos pelo painel mobile-first, e o cliente final fecha pedido sem criar conta — clica "Finalizar pelo WhatsApp" e abre uma conversa pré-formatada com a lojista.

**Cliente piloto da Fase 1:** Sandra Brito Collection (Pedreiras-MA) — roupa feminina + perfume árabe.

**Estimativa de esforço Fase 1:** ~104h dev solo full-time = **3-4 semanas**.

**Custo operacional MVP:** R$ 0/mês (Supabase Free + Vercel Hobby + Resend Free).

---

## 2. Validação via Conselho-5-agentes

Síntese do debate que produziu este plano:

- **AXIOMA**: pressuposto invisível corrigido — "free tier resolve até X usuários" é tempo, não escala. Auto-pausa de 7 dias e 1 GB de storage são timers. **Plano deve ter triggers explícitos de migração**, não esperar dor.
- **LÂMINA**: 7 riscos identificados — auto-pause Supabase, ToS Vercel Hobby (uso comercial), Better Auth não setando `auth.uid()` para Storage RLS, conexão pooling em serverless, build de Next 15 + React 19 + Drizzle, câmera mobile em iOS antigos, estoque sob checkout assíncrono. Todos têm mitigação documentada nas seções 4, 7, 9 e 12.
- **TRATOR**: estimativa de horas por subfase calibrada (seção 17). 6h/dia × 17 dias = 3.5 semanas. Maior bloco: **CRUD de produto com galeria + câmera (~24h)** — não subestimar.
- **NEXUS**: tudo que Sandra achar difícil, outras 100 lojistas vão achar também. Capturar feedback estruturado dela é input pra Fase 2. Decidiu que onboarding < 5 min é métrica única de UX, não bullet aspiracional.
- **ESPELHO**: cliente final no celular, no WhatsApp da loja. > 3s para carregar = perda de confiança. > 2s para imagem = desistência. Performance budget concreto é Lighthouse mobile ≥ 90, LCP < 2.5s.

**Veredito**: GO. Plano executável dentro das restrições do free tier, com gatilhos claros de migração.

---

## 3. Stack tecnológica

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js 15.4 (App Router) | RSC + Server Actions + ISR nativos |
| Runtime UI | React 19 | já no repo base |
| Linguagem | TypeScript estrito | type safety end-to-end com Drizzle |
| ORM | Drizzle ORM | type-safe, migrations versionadas, sem N+1 magic |
| DB | Supabase Postgres (Free) | Postgres real, RLS nativa, console amigável |
| Auth | Better Auth + Drizzle adapter | já no repo base, controla 100% do fluxo |
| Storage | Supabase Storage | mesmo vendor do DB |
| UI lib | shadcn/ui (new-york, neutral) | Radix + Tailwind, já configurado |
| Estilo | Tailwind v4 | já configurado |
| Forms | react-hook-form + Zod | validação compartilhada client/server |
| Estado server | TanStack Query v5 | cache + mutations + optimistic UI |
| Toast | Sonner | já no repo |
| Email | Resend | DX excelente, free tier 3k/mês |
| Animação | lottie-react | renderizar `Approve.json` |
| Validação telefone | libphonenumber-js | E.164 padronizado |
| Compressão imagem | sharp | server-side antes do upload |
| Geração de slug | slugify | normalização determinística |
| ID curto | nanoid | `shortCode` do pedido |
| **Rate limit** | **`@upstash/ratelimit` + `@upstash/redis`** | **proteção `/api/orders`, auth, upload** |
| Deploy | Vercel (Hobby → Pro na Fase 3) | DX, ISR, Image Optimization |
| Cron | Vercel Cron | keep-alive Supabase |
| Cobrança SaaS | Stripe (Fase 3 only) | cobrança da mensalidade do Vitrê — não confundir com checkout do catálogo |

**Removido do repo base**: `@stripe/stripe-js`, `stripe`, `dotenv` (não precisa em Next).

**Adicionado**: `@supabase/supabase-js`, `@supabase/ssr`, `@upstash/ratelimit`, `@upstash/redis`, `lottie-react`, `libphonenumber-js`, `sharp`, `slugify`, `nanoid`, `resend`.

---

## 4. Constraints do tier free e gatilhos de migração

Detalhe completo em [ADR-0005](decisoes/0005-free-tier-supabase-vercel-resend.md).

**Constraints que viraram design**:
- **Max 5 imagens por produto** (não 30) — política do app.
- **Imagens 800×800 WebP 75%** após `sharp` — alvo ~150 KB cada.
- **Vercel Image Optimization** na frente — reduz egress Supabase ~10x.
- **Cron Vercel diário** (`0 9 * * *`) batendo `SELECT 1 FROM store` — impede auto-pause Supabase.
- **Connection pooling**: `DATABASE_URL` aponta pro pooler (porta 6543) com `?pgbouncer=true&connection_limit=1`. `DIRECT_URL` na 5432 só pra migrations.

**Gatilhos de migração**:
| Gatilho | Custo após migrar | Ação |
|---|---|---|
| Storage Supabase > 800 MB | $25/mês | Migrar Supabase Free → Pro |
| DB Supabase > 400 MB | $25/mês (incluso no Pro) | Migrar Supabase Free → Pro |
| Vercel — começar a cobrar mensalidade | $20/mês | Migrar Hobby → Pro (ToS) |
| Resend > 2.500 emails/mês | $20/mês | Migrar Free → paid |
| Auto-pause causou downtime visível | $25/mês | Migrar Supabase imediato |

---

## 5. Arquitetura de dados

### 5.1 Schema (Drizzle)

Arquivos em `src/db/schema/`:

```
src/db/schema/
├── auth.ts          ← user, session, account, verification (Better Auth)
├── store.ts         ← store, store relations
├── catalog.ts       ← category, product, productImage, productVariant, banner
├── order.ts         ← order, orderItem, orderStatus enum
└── index.ts         ← re-export tudo
```

#### `auth.ts` — Better Auth (mantém esquema padrão)

`userTable`, `sessionTable`, `accountTable`, `verificationTable`. Better Auth gerencia. Adicionamos:

```ts
userTable {
  id text PK,
  name, email (unique), emailVerified, image,
  role text default 'store_owner',  // 'store_owner' | 'admin' (futuro)
  createdAt, updatedAt timestamp
}
```

#### `store.ts`

```ts
storeTable {
  id uuid PK defaultRandom,
  ownerId text FK → user.id,
  slug text UNIQUE,                    // /[storeSlug]
  name text,
  description text nullable,
  niche enum [roupa_feminina, joia, semijoia, perfumaria, outro],
  whatsappNumber text,                 // E.164: +5599981757512
  whatsappDisplay text,                // (99) 98175-7512
  logoUrl text nullable,
  iconUrl text nullable,
  primaryColor text default '#000000', // #RRGGBB
  addressStreet, addressNumber text nullable,
  addressNeighborhood, addressCity text nullable,
  addressState text nullable,          // 'MA'
  googleMapsUrl text nullable,
  instagramHandle text nullable,
  isActive boolean default true,
  createdAt, updatedAt timestamp
}
```

Slugs reservados (não pode ser slug de loja): `admin`, `api`, `app`, `www`, `sobre`, `precos`, `entrar`, `criar-loja`, `p`, `_next`, `_legacy`, `assets`, `static`, `auth`, `dashboard`, `vitre`.

#### `catalog.ts`

```ts
categoryTable {
  id uuid PK,
  storeId uuid FK,
  name text,
  slug text,                  // único POR LOJA: UNIQUE(storeId, slug)
  position int default 0,
  isActive boolean default true,
  createdAt timestamp
}

productTable {
  id uuid PK,
  storeId uuid FK,
  categoryId uuid FK nullable,
  name text,
  slug text,                  // único POR LOJA
  description text,
  basePriceInCents int,
  promoPriceInCents int nullable,
  promoStartsAt, promoEndsAt timestamp nullable,
  trackStock boolean default false,
  stockQuantity int nullable, // null + trackStock=false = "ilimitado"
  isActive boolean default true,
  isFeatured boolean default false,  // destaque na home da loja
  createdAt, updatedAt timestamp
}

productImageTable {
  id uuid PK,
  storeId uuid FK,            // redundante mas necessário para RLS
  productId uuid FK,
  url text,                   // Supabase Storage URL
  position int default 0,
  alt text nullable,
  createdAt timestamp
}

productVariantTable {
  id uuid PK,
  storeId uuid FK,
  productId uuid FK,
  name text,                  // "P", "M", "G", "Anel 12", "100ml"
  sku text nullable,
  attributes jsonb default '{}',  // { tamanho: "P", cor: "preto" }
  priceInCents int nullable,  // null = usa basePriceInCents do product
  promoPriceInCents int nullable,
  trackStock boolean default false,
  stockQuantity int nullable,
  isActive boolean default true,
  createdAt timestamp
}

bannerTable {
  id uuid PK,
  storeId uuid FK,
  imageUrl text,
  link text nullable,         // ex: /[storeSlug]/categoria/promocoes
  position int default 0,
  isActive boolean default true,
  createdAt timestamp
}
```

#### `order.ts`

```ts
orderStatus enum [
  'awaiting_whatsapp',  // criado, aguardando cliente clicar no WA
  'confirmed',          // lojista atendeu e confirmou
  'fulfilled',          // entregue
  'canceled',           // lojista ou cliente cancelou
  'expired'             // TTL esgotado, estoque liberado
]

orderTable {
  id uuid PK,
  shortCode text UNIQUE,      // "A7K2"
  storeId uuid FK,
  customerName text,
  customerPhone text,         // E.164
  customerNotes text nullable,
  totalInCents int,
  status orderStatus default 'awaiting_whatsapp',
  whatsappOpenedAt timestamp nullable,
  confirmedAt timestamp nullable,
  expiresAt timestamp,        // NOW() + 24h
  createdAt timestamp
}

orderItemTable {
  id uuid PK,
  orderId uuid FK,
  // SNAPSHOT (não FK forte) — pedido sobrevive a delete de produto
  productId uuid,
  variantId uuid nullable,
  productNameSnapshot text,
  variantNameSnapshot text nullable,
  imageUrlSnapshot text nullable,
  priceInCentsSnapshot int,
  quantity int,
  createdAt timestamp
}
```

### 5.2 RLS e isolamento entre tenants

Detalhe em [ADR-0001](decisoes/0001-multi-tenant-rls-postgres.md).

```sql
-- ativar RLS em cada tabela
ALTER TABLE store           ENABLE ROW LEVEL SECURITY;
ALTER TABLE category        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_image   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item      ENABLE ROW LEVEL SECURITY;

-- política: usuário acessa apenas suas próprias lojas
CREATE POLICY store_owner_access ON store
  USING (owner_id = current_setting('app.current_user_id', true));

-- políticas: tudo que tem store_id é filtrado por tenant
CREATE POLICY tenant_isolation ON product
  USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- (mesmo para category, product_image, product_variant, banner, order, order_item)

-- catálogo público: leitura anônima permitida em produtos/categorias/banners ATIVOS
CREATE POLICY public_read_active ON product
  FOR SELECT TO anon
  USING (is_active = true);
-- (idem category, banner: is_active = true)
```

**Helper Drizzle** (`src/lib/tenant.ts`):
```ts
export async function withTenant<T>(
  storeId: string,
  userId: string,
  fn: (tx: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local app.current_store_id = ${storeId}`);
    await tx.execute(sql`set local app.current_user_id = ${userId}`);
    return fn(tx);
  });
}
```

### 5.3 Estados e transições

**Order**:
```
awaiting_whatsapp ──[lojista marca]──→ confirmed ──→ fulfilled
       │                                  │
       └──[24h TTL]──→ expired            └──[cancela]──→ canceled
```

**Product**: `isActive=false` esconde do catálogo público sem deletar (preserva pedidos antigos).

---

## 6. Arquitetura da aplicação

### 6.1 Estrutura de diretórios

```
vitre/
├── docs/                           ← este documento e amigos
├── public/
│   ├── brand/                      ← logo principal, ícone branco, com nome
│   └── lottie/order-approved.json  ← animação de sucesso
├── src/
│   ├── app/
│   │   ├── (admin)/admin/          ← painel da lojista (auth obrigatório)
│   │   │   ├── layout.tsx          ← AuthGuard + sidebar mobile
│   │   │   ├── page.tsx            ← dashboard (resumo)
│   │   │   ├── produtos/
│   │   │   │   ├── page.tsx        ← lista
│   │   │   │   ├── novo/page.tsx
│   │   │   │   └── [id]/page.tsx   ← editar
│   │   │   ├── categorias/page.tsx
│   │   │   ├── banners/page.tsx
│   │   │   ├── promocoes/page.tsx
│   │   │   ├── pedidos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── configuracoes/page.tsx
│   │   ├── (storefront)/[storeSlug]/   ← catálogo público (sem login)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            ← home
│   │   │   ├── produto/[productSlug]/page.tsx
│   │   │   ├── categoria/[categorySlug]/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   └── checkout/sucesso/page.tsx
│   │   ├── (auth)/
│   │   │   ├── entrar/page.tsx
│   │   │   ├── criar-loja/page.tsx ← onboarding
│   │   │   └── recuperar/page.tsx
│   │   ├── (marketing)/            ← Fase 3
│   │   │   └── page.tsx            ← landing do Vitrê
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts  ← Better Auth
│   │   │   └── cron/keep-alive/route.ts
│   │   ├── p/[token]/page.tsx     ← detalhe público de pedido (publicToken, não shortCode)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── actions/                    ← server actions (Zod-validated)
│   │   ├── product/{create,update,delete,upload-image}.ts
│   │   ├── category/{create,update,delete,reorder}.ts
│   │   ├── banner/{create,update,delete}.ts
│   │   ├── promo/{set,clear}.ts
│   │   ├── store/{update-config,update-logo}.ts
│   │   ├── order/{create-from-cart,update-status}.ts
│   │   └── auth/{sign-up-store, ...}.ts
│   ├── components/
│   │   ├── ui/                     ← shadcn (button, dialog, form, input, etc.)
│   │   ├── admin/                  ← componentes do painel
│   │   │   ├── product-form.tsx
│   │   │   ├── image-uploader.tsx  ← câmera + galeria
│   │   │   ├── price-input.tsx
│   │   │   ├── stock-input.tsx
│   │   │   ├── variant-editor.tsx
│   │   │   └── sidebar-mobile.tsx
│   │   ├── storefront/
│   │   │   ├── store-header.tsx
│   │   │   ├── product-card.tsx
│   │   │   ├── product-gallery.tsx
│   │   │   ├── cart-drawer.tsx
│   │   │   ├── whatsapp-button.tsx
│   │   │   └── lottie-order-approved.tsx
│   │   └── common/
│   │       ├── theme-provider.tsx
│   │       └── react-query-provider.tsx
│   ├── db/
│   │   ├── schema/                 ← split por domínio (ver §5.1)
│   │   ├── index.ts                ← Drizzle client
│   │   └── seed/sandra-brito.ts
│   ├── lib/
│   │   ├── auth.ts                 ← Better Auth config
│   │   ├── auth-client.ts          ← client-side hooks
│   │   ├── supabase/
│   │   │   ├── server.ts           ← service role client
│   │   │   └── storage.ts          ← upload helpers
│   │   ├── tenant.ts               ← withTenant helper
│   │   ├── whatsapp.ts             ← gerador de link wa.me
│   │   ├── slug.ts                 ← reservedSlugs + generateSlug
│   │   ├── shortcode.ts            ← nanoid alphanum 4 chars
│   │   ├── image.ts                ← sharp compress + validation
│   │   ├── env.ts                  ← Zod schema das env vars
│   │   └── utils.ts                ← cn (shadcn)
│   ├── hooks/
│   │   ├── use-cart.ts             ← localStorage por storeId
│   │   ├── use-camera-upload.ts
│   │   ├── mutations/              ← TanStack Query mutations
│   │   └── queries/
│   ├── helpers/
│   │   ├── money.ts                ← formatCentsToBRL (mantém do repo base)
│   │   └── price.ts                ← getEffectivePrice (com promo + variante)
│   └── providers/
│       └── react-query.tsx
├── drizzle/                        ← migrations geradas
├── vercel.json                     ← cron config
├── components.json                 ← shadcn (mantém)
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .env.local                      ← gitignored
├── .gitignore
└── README.md
```

### 6.2 Camadas e fluxo de dados

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT (RSC + Client Components)                            │
│   - Server Components: leitura via db.query.* direto         │
│   - Client Components: TanStack Query → server actions       │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  SERVER ACTIONS (src/actions/**)                             │
│   - "use server"                                             │
│   - Zod parse                                                │
│   - auth.api.getSession() (Better Auth)                      │
│   - withTenant(storeId, userId, ...) ← seta GUC para RLS    │
│   - Drizzle queries                                          │
│   - revalidateTag('store-${slug}') ou revalidatePath()      │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  DRIZZLE → SUPABASE POSTGRES (RLS ativa)                     │
│   - tenant_isolation policies fazem o resto                  │
└──────────────────────────────────────────────────────────────┘

Storage:
┌──────────────────────────────────────────────────────────────┐
│  CLIENT envia File para server action upload-image           │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  SERVER ACTION                                                │
│   - valida tipo, tamanho                                     │
│   - sharp: 800x800, 75%, WebP                                │
│   - supabase.storage.upload(...) com service_role key        │
│   - retorna URL pública                                      │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Padrões enforçados

- **Tudo que escreve passa por server action**. Client nunca chama Drizzle diretamente.
- **Tudo que lê em RSC** usa `db.query.*` direto (sem TanStack Query).
- **Tudo que lê em Client Component** usa `useQuery` (TanStack).
- **Validação dupla**: Zod schema vive em `actions/*/schema.ts`, importado pelo `react-hook-form` no client e pelo server action no server. Single source of truth.
- **Nenhum `any` em código de domínio**.
- **`revalidateTag('store-${slug}')` em toda mutação** que afeta catálogo público.
- **Rate limit obrigatório** em `actions/auth/*`, `actions/order/create-from-cart`, `actions/product/upload-image`. Padrão em `src/lib/rate-limit.ts`. Detalhe em [ADR-0006](decisoes/0006-rate-limit-upstash.md).

### 6.4 Rate limit (Upstash)

```ts
// src/lib/rate-limit.ts (esqueleto)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const rateLimits = {
  createOrder: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "rl:order" }),
  auth:        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 m"), prefix: "rl:auth" }),
  upload:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:upload" }),
  publicApi:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:api" }),
};
```

Helper `checkRateLimit(limiter, identifier)` lança `RateLimitError` capturado pelo error boundary do Next, que mostra mensagem amigável ("Muitas tentativas. Aguarde 1 minuto.").

**Identificadores**:
- IP: `headers().get("x-forwarded-for")?.split(",")[0]`
- userId: `session.user.id`
- Combo (telefone + IP) em pedidos anônimos para evitar burlagem.

---

## 7. Multi-tenancy operacional

Detalhe em [ADR-0001](decisoes/0001-multi-tenant-rls-postgres.md).

### Resolução de tenant em request

**Painel admin (`/admin/*`)**:
1. Middleware Next verifica sessão Better Auth.
2. Server action / RSC chama `getCurrentStore(userId)` → busca primeira `store` onde `ownerId = userId`.
3. `withTenant(storeId, userId, ...)` envolve todas as queries.

**Catálogo público (`/[storeSlug]/*`)**:
1. RSC recebe `params.storeSlug`.
2. `getStoreBySlug(slug)` busca a loja (query bypassa RLS via service_role para resolver slug).
3. Demais queries do storefront usam `withTenant(storeId, ANON_USER_ID)` — RLS aplica `is_active = true` para anon.

### Bypass de RLS (uso restrito)

- Seeds, jobs de migração, cron de keep-alive.
- Usar `supabase.rpc` com `service_role` ou Drizzle conectado com role separado.
- **Sempre logar** quando bypass é usado (linha em `console.warn` por enquanto, observabilidade real na Fase 3).

---

## 8. Auth (Better Auth + roles)

### Configuração

```ts
// src/lib/auth.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, requireEmailVerification: false }, // Fase 1: false; Fase 2: true
  socialProviders: {
    google: { clientId: ..., clientSecret: ... }, // opcional Fase 1
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: "Vitrê <onboarding@vitre.app>",
        to: user.email,
        subject: "Confirme seu email no Vitrê",
        html: `<a href="${url}">Confirmar</a>`,
      });
    },
  },
  user: { additionalFields: { role: { type: "string", defaultValue: "store_owner" } } },
});
```

### Roles

- `store_owner` — único role no MVP. Pode CRUD na sua própria loja.
- `admin` (futuro) — staff Vitrê. Ainda não usado.

### Fluxos

- **Sign up** → cria user → redireciona para `/criar-loja` (onboarding).
- **Sign in** → login → redireciona para `/admin`.
- **Reset password** → email com link via Resend.
- **Sign out** → limpa sessão → redireciona para `/`.

---

## 9. Storage (Supabase + sharp + Vercel Image)

Detalhe em [ADR-0003](decisoes/0003-supabase-storage-imagens.md).

### Buckets

| Bucket | Conteúdo | Read | Write |
|---|---|---|---|
| `store-logos` | logos das lojas | público | service_role via signed URL |
| `store-banners` | banners | público | service_role via signed URL |
| `product-images` | fotos de produto | público | service_role via signed URL |

Estrutura: `<bucket>/<storeId>/<resource>/<filename>.webp`.

### Pipeline de upload

```ts
// src/actions/product/upload-image.ts
"use server";
export const uploadProductImage = async (formData: FormData) => {
  const session = await requireStoreOwner();
  const file = formData.get("file") as File;

  // 1. Valida
  if (file.size > 4 * 1024 * 1024) throw new Error("Imagem muito grande (max 4MB)");
  if (!ALLOWED_MIMES.includes(file.type)) throw new Error("Formato inválido");

  // 2. Comprime
  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  // 3. Upload
  const filename = `${nanoid()}.webp`;
  const path = `${session.storeId}/${productId}/${filename}`;
  const { data, error } = await supabaseService.storage
    .from("product-images")
    .upload(path, compressed, { contentType: "image/webp", upsert: false });
  if (error) throw error;

  // 4. URL pública
  const { data: urlData } = supabaseService.storage
    .from("product-images")
    .getPublicUrl(path);

  // 5. Persiste no DB (com RLS via withTenant)
  await withTenant(session.storeId, session.userId, async (tx) => {
    await tx.insert(productImageTable).values({
      storeId: session.storeId,
      productId,
      url: urlData.publicUrl,
      position: nextPosition,
    });
  });

  revalidateTag(`store-${session.storeSlug}`);
  return { url: urlData.publicUrl };
};
```

### Câmera no painel mobile

```tsx
// src/components/admin/image-uploader.tsx
<input
  type="file"
  accept="image/*"
  capture="environment"   // ← abre câmera traseira no mobile
  multiple
  onChange={handleFiles}
/>
```

`capture="environment"` é honrado pelo iOS Safari ≥ 14 e Android Chrome. Sem suporte = abre galeria (graceful degradation).

### Imagens no catálogo público

```tsx
import Image from "next/image";
<Image
  src={product.images[0].url}
  alt={product.name}
  width={800} height={800}
  sizes="(max-width: 768px) 50vw, 25vw"
  className="aspect-square object-cover"
/>
```

`next/image` faz: lazy load, formato AVIF/WebP automático, srcset, e principalmente — **serve via Vercel CDN, não Supabase**. Egress Supabase só na primeira request.

### `next.config.ts`

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};
```

---

## 10. Catálogo público

### 10.1 Roteamento e ISR

```
/[storeSlug]                              ← home (banner + categorias + destaques + novos)
/[storeSlug]/produto/[productSlug]        ← detalhe do produto
/[storeSlug]/categoria/[categorySlug]     ← lista de produtos da categoria
/[storeSlug]/checkout                     ← carrinho + form cliente
/[storeSlug]/checkout/sucesso             ← Lottie + código curto
/p/[token]                                ← detalhe público do pedido (publicToken 24-char, compartilhável)
```

**ISR** com tag por loja:

```ts
// app/(storefront)/[storeSlug]/page.tsx
export const revalidate = 3600; // 1h
export async function generateStaticParams() { return []; }  // sob demanda

const Home = async ({ params }: { params: Promise<{ storeSlug: string }> }) => {
  const { storeSlug } = await params;
  const data = await unstable_cache(
    async () => {
      const store = await getStoreBySlug(storeSlug);
      const banners = await getBannersByStore(store.id);
      const categories = await getActiveCategories(store.id);
      const featured = await getFeaturedProducts(store.id);
      return { store, banners, categories, featured };
    },
    [`store-${storeSlug}-home`],
    { tags: [`store-${storeSlug}`], revalidate: 3600 }
  )();
  return <StorefrontHome {...data} />;
};
```

Mutações no admin chamam `revalidateTag('store-' + storeSlug)`.

### 10.2 SEO + schema.org

```tsx
// app/(storefront)/[storeSlug]/produto/[productSlug]/page.tsx
export async function generateMetadata({ params }) {
  const { storeSlug, productSlug } = await params;
  const product = await getProductBySlug(storeSlug, productSlug);
  return {
    title: `${product.name} — ${product.store.name}`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.images[0]?.url],
      type: "product",
    },
  };
}

// schema.org Product no JSON-LD
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  image: product.images.map(i => i.url),
  description: product.description,
  offers: {
    "@type": "Offer",
    priceCurrency: "BRL",
    price: (effectivePrice / 100).toFixed(2),
    availability: stockStatus,
  },
})}} />
```

### 10.3 Performance budget

| Métrica | Alvo |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Bundle JS catálogo | < 150 KB gzipped |

Estratégias: RSC por padrão, `next/image`, `next/font` (já no repo), `lottie-react` carregado via `next/dynamic` com `ssr: false`.

---

## 11. Painel admin

### 11.1 Layout mobile-first

- Sidebar virá Sheet em mobile (já existe componente).
- Menu: Dashboard · Produtos · Categorias · Banners · Promoções · Pedidos · Configurações.
- Header: avatar + nome da loja + sair.

### 11.2 CRUD Produto (maior bloco — ~24h)

Tela `/admin/produtos/novo`:
- Form com `react-hook-form` + Zod
- Campos: nome, descrição, categoria (select), `basePriceInCents` (`PriceInput` com máscara BRL via `react-number-format`), `trackStock` (switch), `stockQuantity` (se trackStock=true), `isActive` (switch), `isFeatured` (switch), galeria de imagens (`ImageUploader`), variantes (acordeão opcional).
- Botão "Salvar e adicionar outro" — fluxo otimizado para cadastrar 10 produtos em sequência.
- **Promoção** opcional: switch "Em promoção" → revela `promoPriceInCents` + `promoStartsAt` + `promoEndsAt` (datepicker).

### 11.3 Categoria, banner, promoção, configurações

- **Categoria**: lista drag-and-drop (ordem visual no storefront). CRUD inline.
- **Banner**: upload de imagem (mesmo `ImageUploader`), link opcional, posição.
- **Promoção**: tela agregadora — lista produtos com promo ativa, atalho para limpar tudo.
- **Configurações**: nome da loja, slug (read-only ou rotear cuidadosamente), WhatsApp (input com `libphonenumber-js`), logo, cor primária (color picker), endereço, link Google Maps, Instagram.

### 11.4 Pedidos

- Lista filtrável por status.
- Detalhe: itens, cliente, código curto destacado, ações [Confirmar] [Cancelar] [Marcar como entregue].

---

## 12. Carrinho e checkout WhatsApp

Detalhe em [ADR-0002](decisoes/0002-checkout-whatsapp-codigo-curto.md).

### 12.1 Carrinho client-side

```ts
// src/hooks/use-cart.ts
const STORAGE_KEY = (storeId: string) => `vitre:cart:${storeId}`;

export const useCart = (storeId: string) => {
  // ler/escrever localStorage
  // shape: { items: [{ productId, variantId, quantity, snapshot: {...} }], updatedAt }
  // expira após 7 dias
};
```

Cada loja tem carrinho isolado por storeId no localStorage.

### 12.2 Checkout

```
/[storeSlug]/checkout
```

UI:
1. Lista do carrinho (editar quantidade, remover).
2. Form: nome do cliente, telefone (E.164 via libphonenumber-js), observações (opcional).
3. Botão "Finalizar pelo WhatsApp" (verde, com ícone WA).

Fluxo do botão:

```ts
// src/actions/order/create-from-cart.ts
"use server";
export const createOrderFromCart = async (input: CreateOrderInput) => {
  const data = createOrderSchema.parse(input);
  const store = await getStoreBySlug(data.storeSlug);

  // valida itens contra o DB (preços, ativo)
  const validatedItems = await validateCartItems(store.id, data.items);
  const total = validatedItems.reduce((acc, i) => acc + i.priceInCents * i.quantity, 0);

  // gera shortCode único
  const shortCode = await generateUniqueShortCode();

  // cria order + items em transação
  const order = await withTenant(store.id, ANON_USER_ID, async (tx) => {
    const [order] = await tx.insert(orderTable).values({
      shortCode,
      storeId: store.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerNotes: data.customerNotes,
      totalInCents: total,
      expiresAt: addHours(new Date(), 24),
    }).returning();

    await tx.insert(orderItemTable).values(
      validatedItems.map(i => ({ orderId: order.id, ...i }))
    );
    return order;
  });

  // monta mensagem WA
  const waUrl = buildWhatsAppLink({
    phone: store.whatsappNumber,
    order,
    items: validatedItems,
    publicUrl: `${env.APP_URL}/p/${shortCode}`,
  });

  // marca whatsappOpenedAt
  await markWhatsAppOpened(order.id);

  return { shortCode, waUrl };
};
```

### 12.3 Mensagem WhatsApp

`src/lib/whatsapp.ts`:

```ts
export const buildWhatsAppLink = ({ phone, order, items, publicUrl }) => {
  const lines = [
    `*Pedido #${order.shortCode}*`,
    `Olá! Quero fazer este pedido:`,
    "",
    ...items.slice(0, 10).map(i =>
      `• ${i.quantity}x ${i.productNameSnapshot}${i.variantNameSnapshot ? ` (${i.variantNameSnapshot})` : ""} — ${formatBRL(i.priceInCents * i.quantity)}`
    ),
    items.length > 10 ? `_(+ ${items.length - 10} itens — ver detalhes)_` : "",
    "",
    `*Total: ${formatBRL(order.totalInCents)}*`,
    "",
    `Detalhes: ${publicUrl}`,
    `Cliente: ${order.customerName}`,
  ].filter(Boolean);

  let text = lines.join("\n");
  if (text.length > 1900) text = text.slice(0, 1850) + `...\n\nDetalhes completos: ${publicUrl}`;

  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
};
```

### 12.4 Tela de sucesso

`/[storeSlug]/checkout/sucesso?code=A7K2`:
- Lottie `Approve.json` (autoplay, loop=false)
- "Pedido enviado!"
- "Seu código: **A7K2**"
- "Volte ao catálogo" → `/[storeSlug]`

### 12.5 Página pública do pedido `/p/A7K2`

- Mostra resumo do pedido (sem login).
- Útil para cliente final salvar / lojista compartilhar.
- TTL de 30 dias após `confirmedAt` ou `expiresAt`.

---

## 12.6 Identidade visual

Detalhe completo em [ADR-0007](decisoes/0007-identidade-visual-vitre.md).

### Cor primária Vitrê

`#1E3FE6` (azul royal vibrante extraído da logo). Escala 50-950 declarada em `src/app/globals.css` como tokens Tailwind v4:

```css
@theme {
  --color-vitre-50:  #EEF2FE;
  --color-vitre-100: #DCE5FD;
  --color-vitre-200: #B9CBFB;
  --color-vitre-300: #8FAAF8;
  --color-vitre-400: #5B7DF1;
  --color-vitre-500: #1E3FE6;  /* logo */
  --color-vitre-600: #1832C2;
  --color-vitre-700: #14279E;
  --color-vitre-800: #112180;
  --color-vitre-900: #0C1862;
  --color-vitre-950: #070D3D;
}
```

Uso: `bg-vitre-500`, `text-vitre-600`, `ring-vitre-500/20`, etc.

### Pegada visual

- **Painel admin**: cor fixa Vitrê. Cards `rounded-2xl`, sombras leves, bordas sutis (`border-neutral-200`), espaçamento generoso (`space-y-6`, `gap-4`). Sem gradientes excessivos. Lucide-react para ícones.
- **Storefront**: cor primária = `store.primaryColor` (configurável). Default = azul Vitrê. Aplicada via CSS custom property no `(storefront)/[storeSlug]/layout.tsx`.

### Paleta sugerida no onboarding

8 cores curadas + opção "Outra cor" (hex válido). Não color picker livre. Lista em `src/lib/brand.ts`:

```ts
export const SUGGESTED_PRIMARY_COLORS = [
  { name: "Azul Vitrê",      value: "#1E3FE6" },
  { name: "Preto",           value: "#0A0A0A" },
  { name: "Rosa",            value: "#E91E63" },
  { name: "Verde Esmeralda", value: "#10B981" },
  { name: "Vinho",           value: "#9F1239" },
  { name: "Areia",           value: "#A38468" },
  { name: "Roxo",            value: "#7C3AED" },
  { name: "Laranja",         value: "#EA580C" },
];
```

### Logos (`public/brand/`)

- `logo-principal.webp` — telas de login, marketing, emails
- `icone-branco.webp` — headers, favicons
- `com-nome.webp` — rodapés, "Powered by Vitrê"

---

## 13. Onboarding lojista

Meta: **≤ 5 minutos** do "criar conta" até "primeiro produto cadastrado".

### Fluxo

```
Tela 1: /entrar         → "Criar minha loja"
Tela 2: /criar-loja/conta    → email + senha + nome
                              → cria user → cria sessão → próxima
Tela 3: /criar-loja/identidade
  - Nome da loja
  - Slug (auto-gerado, editável, validado em tempo real contra reservedSlugs e duplicatas)
  - Nicho (radio: Roupa feminina / Joia / Semijoia / Perfumaria / Outro)
  - WhatsApp (input com máscara + validação E.164)
  - Cor primária (3 sugestões + custom)
  - Logo (upload opcional, default = iniciais sobre cor primária)
Tela 4: /criar-loja/categorias
  - Pré-populado com categorias do nicho escolhido (editável)
    Ex: Joia → ["Anéis", "Brincos", "Colares", "Pulseiras"]
    Ex: Roupa feminina → ["Vestidos", "Blusas", "Calças", "Saias", "Acessórios"]
Tela 5: /criar-loja/primeiro-produto (opcional, "Pular para depois")
  - Form simplificado (foto + nome + preço)
Tela 6: /admin (dashboard) com toast "Sua loja está no ar! vitre.app/<slug>"
```

### Pré-população de categorias por nicho

```ts
const NICHE_CATEGORIES = {
  roupa_feminina: ["Vestidos", "Blusas", "Calças & Saias", "Acessórios"],
  joia: ["Anéis", "Brincos", "Colares", "Pulseiras"],
  semijoia: ["Anéis", "Brincos", "Colares", "Conjuntos"],
  perfumaria: ["Perfumes Importados", "Nacionais", "Body Splash"],
  outro: [],
};
```

---

## 14. Variáveis de ambiente

`.env.example` (commit) e `.env.local` (gitignored):

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database (Supabase Postgres via pooler)
DATABASE_URL=postgres://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgres://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>

# Better Auth
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=  # opcional Fase 1
GOOGLE_CLIENT_SECRET=

# Resend
RESEND_API_KEY=re_<...>
RESEND_FROM_EMAIL=onboarding@vitre.app  # ou subdomínio Vercel até comprar

# Upstash Redis (rate limit)
UPSTASH_REDIS_REST_URL=https://<region>-<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>

# Cron secret (proteção do endpoint cron)
CRON_SECRET=<openssl rand -hex 32>
```

`src/lib/env.ts` valida tudo via Zod no boot. Build falha se faltar variável.

---

## 15. Plano de deploy

### 15.1 Pré-deploy (local)

1. `npm install` (com deps novas)
2. `npm run db:generate` (Drizzle gera migrations)
3. `npm run db:push` (aplica no Supabase Free)
4. `npm run db:seed` (cria Sandra Brito + categorias placeholder + 10 produtos placeholder)
5. `npm run dev` — testar fluxo completo localmente
6. `npm run build` — garantir que builda sem erro

### 15.2 Setup Supabase (UI da Supabase)

1. Criar projeto Free na região `sa-east-1` (São Paulo).
2. Pegar `DATABASE_URL` (pooler, 6543), `DIRECT_URL` (5432), `anon key`, `service_role key`.
3. **Desabilitar** Supabase Auth (não usamos — usamos Better Auth).
4. Storage → criar buckets `store-logos`, `store-banners`, `product-images` como **public** (read).
5. Storage policies → bloquear write de anon (escrita só com service_role).
6. SQL Editor → rodar script de RLS policies (gerado pelo Drizzle ou manual).
7. Database → connection pooling: confirmar **transaction mode**.

### 15.3 Setup Vercel

1. `vercel link` com a CLI ou conectar GitHub.
2. Importar repo.
3. Environment Variables: copiar todas do `.env.local` (de produção).
4. Build command: `npm run build` (default).
5. Region: `gru1` (São Paulo).
6. Deploy.

### 15.4 Setup Resend

1. Criar conta.
2. Adicionar domínio `vitre.app` (verificar DNS) ou usar `onboarding@resend.dev` enquanto não tem domínio.
3. Pegar API key → `RESEND_API_KEY`.

### 15.5 Vercel Cron (keep-alive)

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/keep-alive", "schedule": "0 9 * * *" }
  ]
}
```

`app/api/cron/keep-alive/route.ts`:
```ts
export const GET = async (request: Request) => {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await db.execute(sql`SELECT 1 FROM store LIMIT 1`);
  return Response.json({ ok: true, at: new Date().toISOString() });
};
```

Vercel chama com `Authorization: Bearer ${CRON_SECRET}` automaticamente quando a env está setada.

### 15.6 Domínio

- Fase 1: usar `vitre-app.vercel.app` (gratuito).
- Fase 2: comprar domínio `.site` (~R$ 25/ano), apontar A record para Vercel, configurar.
- Subdomínio `app.vitre.site` opcional para separar app de marketing.

### 15.7 Pós-deploy (smoke test em produção)

- [ ] Acessar `vitre-app.vercel.app/sandra-brito` → catálogo da Sandra carrega
- [ ] Adicionar 1 produto ao carrinho → finalizar pelo WhatsApp → confirma redirect com código curto
- [ ] Login Anderson → `/admin` → criar 1 produto pelo celular com câmera → confirma upload
- [ ] Verificar que pedido apareceu em `/admin/pedidos`
- [ ] Lighthouse mobile no catálogo: ≥ 90
- [ ] Cron Vercel rodou: ver log em `vercel.com/.../crons`

---

## 16. Operações

### 16.1 Monitoramento (manual no MVP)

Semanal, Anderson verifica:
- Supabase Dashboard → Database size, Storage size.
- Vercel Dashboard → bandwidth, function invocations.
- Resend Dashboard → emails enviados.

Se qualquer um passar de 70% do limite, planejar migração na próxima semana.

### 16.2 Backup

- Supabase Free faz **daily backup automático**, retém 7 dias.
- Restore via Supabase Dashboard → Database → Backups.

### 16.3 Runbooks (a popular)

- `runbooks/deploy-vercel.md`
- `runbooks/troubleshooting-rls.md` — como debugar vazamento ou bloqueio.
- `runbooks/restore-supabase.md`
- `runbooks/migracao-free-para-pro.md`
- `runbooks/onboarding-novo-tenant.md` — manual até Fase 2.

---

## 17. Critérios de aceitação Fase 1

| # | Entregável | Pronto quando | Estimativa |
|---|---|---|---|
| 1 | Schema multi-tenant + RLS | `npm run db:push` cria tudo. Teste manual: lojista A não enxerga produto da loja B | 8h |
| 2 | Better Auth + roles + recuperação de senha | Sign up → cria user → role `store_owner`. Reset password manda email Resend | 12h |
| 3 | Onboarding `/criar-loja` (5 telas) | Cobaia consegue criar loja em ≤ 5 min sem ajuda | 10h |
| 4 | Admin: CRUD produto com galeria + câmera + estoque + variantes | Cadastrar 5 produtos pelo celular em < 10 min, com foto da câmera | 24h |
| 5 | Admin: CRUD categoria + banner + promoção + configurações | Sandra customiza loja inteira sem ajuda técnica | 16h |
| 6 | Catálogo público `/[storeSlug]` com ISR + SEO | Lighthouse mobile ≥ 90, schema.org Product válido | 20h |
| 7 | Carrinho localStorage + checkout WhatsApp + Lottie | Cliente final pede pelo WA, lojista vê pedido em `/admin/pedidos`, código curto bate | 12h |
| 8 | Deploy Vercel + Supabase prod + Cron + seed Sandra | Sandra recebe link `vitre-app.vercel.app/sandra-brito` funcional | 6h |

**Total: ~108h**. Fila prevista: 17-18 dias úteis (6h/dia) = **~3.5 semanas**.

---

## 18. Riscos conhecidos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Auto-pause Supabase derruba catálogo | Média | Alto | Cron diário (§15.5) + alerta se cron falhar |
| Storage Supabase estoura 1 GB | Baixa no MVP | Alto | Limite duro de 5 imagens × 150 KB no app |
| ToS Vercel Hobby vs cobrança | Certa na Fase 3 | Bloqueante | Migrar pra Pro ($20/mês) antes de cobrar |
| Câmera mobile falha em iOS antigo | Baixa | Baixo | Fallback para galeria (mesmo input file) |
| Sandra não consegue cadastrar produto | Média | Alto | Sessão de onboarding presencial assistida com ela |
| Cliente final desiste antes do WA | Média | Médio | Pedido fica registrado como `awaiting_whatsapp` — lojista vê e pode contatar |
| Vazamento entre tenants | Baixa | Catastrófico | RLS no banco + testes de regressão antes de cada deploy |
| Build Next 15 + React 19 + Drizzle quebra | Baixa | Médio | Stack já validada no repo base; ir em commits pequenos |
| Connection pool esgota em pico | Baixa | Alto | Pooler + `connection_limit=1` por function |

---

## Referências cruzadas

- [Visão do produto](produto/visao.md) · [Personas](produto/personas.md) · [Roadmap](produto/roadmap.md)
- [ADR-0001 Multi-tenant + RLS](decisoes/0001-multi-tenant-rls-postgres.md)
- [ADR-0002 Checkout WhatsApp](decisoes/0002-checkout-whatsapp-codigo-curto.md)
- [ADR-0003 Supabase Storage](decisoes/0003-supabase-storage-imagens.md)
- [ADR-0004 Routing path-based](decisoes/0004-routing-path-based.md)
- [ADR-0005 Tier free](decisoes/0005-free-tier-supabase-vercel-resend.md)
- [Cliente piloto Sandra Brito](clientes/sandra-brito-collection.md)
- [Sessão fundadora 2026-05-07](sessoes/2026-05-07-conselho-fundacao.md)
- [Glossário](glossario.md)
