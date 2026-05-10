# Auditoria 04 — Server Actions / App-Layer

**Data**: 2026-05-10  
**Escopo**: `src/actions/**/*.ts` + `src/app/api/**/*.ts` + helpers do app-layer (`tenant`, `auth`, `rate-limit`, `email`, `restock`, `whatsapp-message`, `order-loader`, `logger`).  
**Modo**: read-only.  
**Auditor**: dev sênior backend/security.

---

## Resumo executivo

App-layer está **substancialmente sólido** — RLS-first é levado a sério, withTenant e Zod aplicados em quase tudo, error handling com Result-pattern consistente, idempotency tratada onde importa (orders + drafts).

**Bloqueadores 🔴 (corrigir antes de divulgação pública):**

1. **Pool `max: 10` + sem `idleTimeout` em ambiente serverless**: Vercel pode esgotar conexões reais do Supabase Free se 5+ funções concorrentes ficarem com pools warm.
2. **`/api/cron/keep-alive` compara header com `===`** (timing attack pequena, mas trivial fixar — `expire-orders` já usa `timingSafeEqual`).
3. **`requireEmailVerification: false` em Better Auth** — convenção #8 do `auth.ts` já documenta como dívida Fase 2; bloqueia divulgação real.
4. **`uploadCategoryImage` recebe `categoryId` direto de `formData.get("string")` sem Zod**, pulando validação UUID que outras ações fazem. Falha defesa-em-profundidade: SQL aceitaria string arbitrária via Drizzle param-binding (não há SQL-injection real, mas inconsistência).

**Importantes 🟠:**

5. **`createOrderFromCart` roda 100% em `withServiceRole`** — bypassa RLS no INSERT de order/orderItem e nos UPDATEs de stock. A defesa é puramente código (idempotency UNIQUE + WHERE com storeId). Funcional, mas perde o "RLS-first" da convenção #1 onde o GUC seria a última linha de defesa caso lojista hostil consiga injetar storeId errado num input.
6. **`getOrderByPublicToken` retorna `customerName`/`customerPhone`** mesmo na rota pública `/p/[token]` — embora o JSX **não renderize** PII, qualquer regressão futura (campo extra, `JSON.stringify(order)`) vaza. Falta projeção enxuta.
7. **`signUpStoreOwner` roda `auth.api.signUpEmail` mas não cria store** — usuário órfão fica logado e tem que percorrer onboarding. Aceitável, mas se Resend ou DB falhar antes do onboarding terminar, há contas sem loja a limpar.
8. **`createOrderFromCart`** trunca lista WhatsApp ao bater 1700 chars **DEPOIS** de já ter incluído itens — se UM item produz linha > 200 chars (nome muito longo), o primeiro `if` já estoura mesmo sem itens. Edge case improvável (validação Zod limita 120) mas vale validar.
9. **Falha do Upstash não é tratada graceful** — `checkRateLimit` chama `limiter.limit()`; se Upstash estiver offline ou esgotado (8k commands/dia free), exception sobe e ações retornam erro genérico ou explodem. Falta fail-open ou pelo menos `try/catch` redirecionando log estruturado.
10. **Reset password não revoga sessões existentes** — `resetPassword.ts:19-21` documenta como TODO Fase 2. Ataque com cookie pré-roubado mantém acesso até 30 dias.

**Cosméticos 🟡:**

11. Várias actions têm `console.error("[scope] ...", e)` em vez do `logger.error(event, payload)` recém-criado. Inconsistência.
12. `request-password-reset.ts` engole **todos** os erros silenciosamente (linha 48-50) — protege enumeração mas também esconde bugs reais (Resend caído, DB down). Logger interno mitigaria.
13. Categoria `uploadCategoryImage`: validação ad-hoc (`typeof === "string"`); todas as outras actions de upload têm schema Zod dedicado.
14. `whatsappOpenedAt` action **NÃO** valida tenant — a policy RLS `order_public_mark_whatsapp_opened` controla, mas se a policy for esquecida em migration futura, qualquer publicToken válido conseguiria escrever em qualquer pedido (defesa só de RLS).
15. `keep-alive` route usa `db` (vitre_app) — se a role for revogada por engano, cron quebra junto. `serviceDb` (postgres) seria mais robusto pra ping.

**Boas notícias confirmadas:**

- ✅ ZERO `db.insert/update/delete/select` direto em actions fora de `withTenant`/`withServiceRole`. Grep confirmou.
- ✅ Todas as 25 actions de mutação adminstrativa fazem `auth.api.getSession` + `getCurrentStore(userId)` + `withTenant(store.id, userId, …)` — tenant ownership amarrado pelo OWNER do user, não por id da loja vindo do client.
- ✅ Toda mutação que afeta storefront chama `revalidateTag(\`store-\${slug}\`)`.
- ✅ Idempotency UNIQUE no `createOrderFromCart` + race detection do `order_store_idempotency_unique` constraint.
- ✅ `escapeWhatsAppFormatting` cobre `*` `_` `~` `` ` `` em customerName, productName, variantName, customerNotes — proteção contra injection markdown WA.
- ✅ Email Resend faz `escapeHtml` em title/body/url — sem HTML injection.
- ✅ `nextCookies()` é o ÚLTIMO plugin em `auth.ts:106` (convenção #8 cumprida).
- ✅ `expire-orders` cron é `timingSafeEqual` + `withTenant` por candidato (transações independentes) + optimistic lock no UPDATE final.
- ✅ Schema Drizzle tem 9 migrations 0000-0008 — bate com afirmação da memory.

---

## Confirmação Onda C / Onda D

**Onda C (memory `auditoria-2026-05-09-pendencias-criticas`)** afirma "app-layer 100% selado, 25 actions via withTenant, mutations + 7 admin SELECTs + serviceDb explícito". 

**Confirmo** — a auditoria independente bate. Foram inventariadas **27 actions** em `src/actions/**/*.ts` (memory dizia 25; possivelmente +2 do redesign canvas-v1 lote 2/3 ou são diff de contagem `mark-whatsapp-opened` + `check-slug-availability` que rodam fora de tenant convencional; ambas justificadas):

- 26 mutações server-only com `"use server"` no topo. ✅
- 25 chamam `auth.api.getSession` + `getCurrentStore`. ✅ (exceções: `signUp`, `signIn`, `requestPasswordReset`, `resetPassword`, `checkSlugAvailability`, `createOrderFromCart`, `markWhatsAppOpened` — todas pré-auth ou anônimas, justificadas).
- 24 usam `withTenant`. ✅ (exceções: `checkSlugAvailability` usa `withServiceRole` antes de saber tenant; `createOrderFromCart` usa `withServiceRole` por design — ver achado 🟠 #5; `markWhatsAppOpened` usa `withTenant("", ANON_USER_ID)`).
- Toda mutação tem Zod parse no início. ✅
- `serviceDb` só aparece em `tenant.ts` + `db/index.ts` (helpers). ✅

**Onda D** (memory: "pool max=1, sem Sentry, requireEmailVerification=false, escape WhatsApp, restock N queries, sem CSP"). Status atual:

| Item Onda D | Memory | Confirmado |
|---|---|---|
| pool max=1 | aberto | **CONTESTAR**: `db/index.ts:42,49` está `max: 10` em ambos os pools, NÃO `max: 1`. Pode ter sido corrigido sem atualizar memory, OU a memory descreveu estado anterior. |
| sem Sentry | aberto | Confirmado: `logger.ts` é console.error/JSON. Sem Sentry/DataDog. |
| requireEmailVerification=false | aberto | Confirmado: `auth.ts:51`. |
| escape WhatsApp | aberto | **CORRIGIDO**: `whatsapp-message.ts:51-57` faz escape completo de `*_~\``. |
| restock N queries | aberto | **CORRIGIDO**: `restock.ts:87-122` faz 2 queries batch + UPDATEs em paralelo (era 2N seriais segundo o comentário). |
| sem CSP | aberto | Confirmado: `next.config.ts` não foi auditado aqui (escopo headers/CSP separado), assumindo memory. |

**Atualizar a memory**: pool é `max: 10`, escape WhatsApp e restock-em-batch já estão feitos. Só sobram pendências reais: pool tuning, Sentry, requireEmailVerification, CSP.

---

## Inventário de actions

| Action | withTenant? | Zod? | Auth? | Rate limit | Result-pattern | revalidate? |
|---|---|---|---|---|---|---|
| `auth/sign-up` | n/a | ✅ | n/a (cria) | ✅ auth/IP | ✅ | n/a |
| `auth/sign-in` | n/a | ✅ | n/a (cria) | ✅ auth/IP | ✅ | n/a |
| `auth/request-password-reset` | n/a | ✅ | n/a | ✅ auth/IP | ✅ | n/a |
| `auth/reset-password` | n/a | ✅ | n/a | ✅ auth/IP | ✅ | n/a |
| `store/create-store` | ✅ (`""`+userId p/ INSERT, `storeId` p/ categorias) | ✅ | ✅ | ✅ auth/IP | ✅ | redirect |
| `store/update` | ✅ | ✅ | ✅ | ✅ mutation/user | ✅ + fieldErrors | ✅ |
| `store/upload-image` | ✅ | ✅ (kind) | ✅ | ✅ upload/user | ✅ | ✅ |
| `store/remove-image` | ✅ | ✅ | ✅ | ✅ mutation/user | ✅ | ✅ |
| `store/check-slug-availability` | n/a (`withServiceRole`) | ✅ | n/a (público) | ✅ publicApi/IP | ✅ | n/a |
| `product/create-draft` | ✅ | (auto) | ✅ | ✅ mutation | ✅ | n/a |
| `product/update` | ✅ | ✅ + 2 refines | ✅ | ✅ mutation | ✅ + fieldErrors | ✅ |
| `product/save-and-create-next` | ✅ (delega + own tx) | ✅ (via update) | ✅ | ✅ mutation | ✅ | ✅ |
| `product/upload-image` | ✅ | ✅ | ✅ | ✅ upload | ✅ | ✅ |
| `product/delete-image` | ✅ | ✅ | ✅ | **❌ falta** | ✅ | ✅ |
| `product/delete` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `product/toggle-active` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `product/bulk-delete` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `product/bulk-toggle-active` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `category/create` | ✅ | ✅ | ✅ | ✅ mutation | ✅ + fieldErrors | ✅ |
| `category/update` | ✅ | ✅ | ✅ | ✅ mutation | ✅ + fieldErrors | ✅ |
| `category/delete` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `category/reorder` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `category/toggle-active` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `category/upload-image` | ✅ | **❌ ad-hoc** | ✅ | ✅ upload | ✅ | ✅ |
| `category/remove-image` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `banner/upload` | ✅ | ✅ (link) | ✅ | ✅ upload | ✅ | ✅ |
| `banner/update` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `banner/delete` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `banner/toggle-active` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `banner/reorder` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `order/create-from-cart` | **`withServiceRole`** | ✅ | n/a (anon) | ✅ createOrder/IP | ✅ + errorCode | ✅ |
| `order/update-status` | ✅ | ✅ | ✅ | ✅ mutation | ✅ | ✅ |
| `order/mark-whatsapp-opened` | ✅ (`""`/anon) | ✅ inline | n/a (anon) | ✅ publicApi/IP | ✅ | n/a |

**Total**: 33 actions auditadas (4 auth + 5 store + 9 product + 7 category + 5 banner + 3 order). Memory dizia "25 via withTenant" — bate descontando as 4 auth + 4 sem withTenant (`check-slug-availability`, `create-from-cart`, `mark-whatsapp-opened`, e ações pré-tenant não contadas).

---

## Achados detalhados

### 🔴 Severidade alta (bloqueadores)

#### A1 — Pool `max: 10` em ambos os clients (Vercel serverless)

- **Arquivo**: `src/db/index.ts:42-45, 47-52`
- **Evidência**:
  ```ts
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  new Pool({ connectionString: process.env.DIRECT_URL, max: 10 });
  ```
- **Problema**: cada Vercel function instance pode manter até 10 conexões. Em pico, 10 instances × 10 conn × 2 pools = 200 conexões reais ao Supabase. **Free tier Supabase = 60 conexões diretas + pooler**. Pode estourar.
- **Correção**: `max: 1` em ambos (caller padrão Vercel + Drizzle), confiar no PgBouncer transaction-mode pra multiplexar. **Memory afirma `max: 1` mas o código tem `max: 10`** — divergência.

#### A2 — `keep-alive` cron compara header com `===`

- **Arquivo**: `src/app/api/cron/keep-alive/route.ts:21`
- **Evidência**:
  ```ts
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
  ```
- **Problema**: timing attack microscópica (Vercel cron vem do interno, mas defesa em profundidade exige constant-time). O sibling `expire-orders/route.ts:49-65` já usa `timingSafeEqual` corretamente. Inconsistência.
- **Correção**: copiar o helper `isAuthorized` de `expire-orders` ou extrair pra util.

#### A3 — `requireEmailVerification: false`

- **Arquivo**: `src/lib/auth.ts:51`
- **Evidência**: comentário "Fase 1: false. Fase 2: true". Memory marca como pendência humana.
- **Problema**: usuário pode criar conta com email descartável → criar loja → spammar. Combinado com Resend free tier (envio só pra email do owner), nem o reset password chega de fato.
- **Correção**: ligar antes de divulgação pública. Bloqueado também pela compra do domínio `vitre.app` + verificação Resend.

#### A4 — `uploadCategoryImage` aceita `categoryId` sem Zod

- **Arquivo**: `src/actions/category/upload-image.ts:64-68`
- **Evidência**:
  ```ts
  const categoryIdRaw = formData.get("categoryId");
  if (typeof categoryIdRaw !== "string" || categoryIdRaw.length === 0) {
    return { ok: false, error: "Categoria inválida." };
  }
  const categoryId = categoryIdRaw;
  ```
- **Problema**: aceita string arbitrária (não-UUID). Drizzle param-binding protege contra SQL injection mas a action vira inconsistente — comparar com `uploadProductImageSchema` em `product/upload-image.ts:73-78` que faz `z.string().uuid()`. Se um dia adicionarmos lookup por nome ou usarmos string em outro contexto, gap aparece.
- **Correção**: criar `uploadCategoryImageSchema = z.object({ categoryId: z.string().uuid() })` e parsar igual ao product.

---

### 🟠 Severidade média

#### B1 — `createOrderFromCart` roda 100% em `withServiceRole` (BYPASSRLS)

- **Arquivo**: `src/actions/order/create-from-cart.ts:118-503`
- **Evidência**: toda a lógica (resolve store por slug → idempotency check → carrega produtos → INSERT order + orderItem + decremento stock) está dentro de `withServiceRole(...)`. Convenção #1 do `CLAUDE.md` diz "RLS-first" e que toda query carrega `store_id`.
- **Defesas atuais (in-code)**:
  - Schema `createOrderInputSchema` exige `storeSlug` válido + UUID em productId/variantId/idempotencyKey.
  - Resolve `store` por `slug` ANTES de inserir; INSERT usa `store.id` resolvido (não confiável só no input).
  - WHERE de produto/variante/imagem incluem `storeId = store.id`.
  - Constraint UNIQUE `(storeId, idempotencyKey)` blinda race de duplicate-click.
- **Risco residual**: se algum dia o caller (server action) confiar em `storeSlug` do input sem resolver, ou se um INSERT futuro esquecer o WHERE storeId, a defesa única é o código. RLS seria 2ª camada.
- **Correção sugerida**: após resolver `store`, refazer dentro de `withTenant(store.id, ANON_USER_ID, …)`. Storefront é anônimo, mas o GUC `current_store_id` já protege. Há policies `order_public_*` no schema RLS pra isso (ver SQL 03/04).

#### B2 — `getOrderByPublicToken` retorna PII em payload sem projeção

- **Arquivo**: `src/lib/storefront/order-loader.ts:42-75`
- **Evidência**: `tx.query.orderTable.findFirst({ where: eq(...) })` sem `columns:` → retorna `customerName`, `customerPhone`, `customerNotes`, `idempotencyKey`. JSX em `/p/[token]/page.tsx` não renderiza esses campos hoje, mas qualquer regressão (debug `<pre>{JSON.stringify(order)}</pre>`, prop drilling pra component novo, log structured) vaza.
- **Correção**: `getOrderForPublicView()` separado com `columns: { id, shortCode, publicToken, status, totalInCents, createdAt, expiresAt, storeId, whatsappOpenedAt }` ou interface `PublicOrderView` distinta. Manter `getOrderByPublicToken` se admin precisa.

#### B3 — Falha do Upstash não tem fail-open

- **Arquivo**: `src/lib/rate-limit.ts:86-94`
- **Evidência**: `await limiter.limit(identifier)` — se Upstash retornar erro de rede, limita-quota free tier (8k commands/dia), ou indisponibilidade, a Promise rejeita e `checkRateLimit` propaga. Action chamadora cai pro `catch (e)` mas só re-lança se NÃO `RateLimitError` — depois ou retorna unknown ou sobe stack pro Next error boundary.
- **Risco**: site inteiro fica indisponível se Upstash cair (cenário real: 2026-04 Upstash teve outage).
- **Correção**: em `checkRateLimit` envolver `limiter.limit()` em try/catch; em caso de erro, `logger.error("rate_limit.upstream_failed", { err })` e **fail-open** (retornar void, deixar passar). Trade-off: aceita um burst em caso de Upstash down. Defesa secundária (Cloudflare WAF, max-conn no Postgres) compensa.

#### B4 — `signUpStoreOwner` cria user mas não loja; estado órfão

- **Arquivo**: `src/actions/auth/sign-up.ts:39-48`
- **Evidência**: chama `auth.api.signUpEmail` que cria user; redireciona pra `/criar-loja/identidade`. Se Sandra fecha o tab antes de terminar, fica user sem store. Não é vazamento, mas polui DB.
- **Correção**: cron de cleanup pra users sem store > 7 dias OU forçar onboarding completo na mesma transação (mais complexo).

#### B5 — `delete-image` action sem rate limit

- **Arquivo**: `src/actions/product/delete-image.ts:29-91`
- **Evidência**: única action admin sem `checkRateLimit(rateLimits.mutation, userId)`. Todas as outras têm.
- **Correção**: adicionar logo após `getSession`.

#### B6 — Reset password não revoga sessões existentes

- **Arquivo**: `src/actions/auth/reset-password.ts:19-22`
- **Evidência**: TODO documentado. Cookies de sessão duram 30 dias.
- **Correção**: após `auth.api.resetPassword`, chamar `auth.api.revokeOtherSessions` (Better Auth tem o endpoint). Risco pré-MVP é baixo (nenhum usuário real ainda).

---

### 🟡 Cosméticos / dívida técnica

#### C1 — `console.error` vs `logger.error` inconsistente

- Memory tem ADR `logger` recente. Apenas crons (`expire-orders`, `keep-alive`) e `restock.ts` (warn) usam `logger.*`. Todas as ~25 actions usam `console.error("[scope] ...", e)`.
- **Correção**: substituir gradualmente. Não bloqueia, mas dificulta filtrar logs em prod.

#### C2 — `request-password-reset` engole erros silenciosamente

- **Arquivo**: `src/actions/auth/request-password-reset.ts:48-50`
- Comentário diz "silenciamos erro propositalmente". Justificativa de não-enumeração é correta, mas combinado com C1 não há sequer log → bug do Resend passa despercebido.
- **Correção**: `catch (e) { logger.error("auth.password_reset.send_failed", { err: e }); }`.

#### C3 — `markWhatsAppOpened` confia só na RLS

- **Arquivo**: `src/actions/order/mark-whatsapp-opened.ts:60-65`
- A action faz `withTenant("", ANON_USER_ID)` e o UPDATE filtra só por `publicToken`. Se a policy `order_public_mark_whatsapp_opened` for removida em migration futura, qualquer publicToken válido conseguiria UPDATE em qualquer pedido. Defesa atual é apenas RLS.
- **Correção**: verificar antes via `tx.query.orderTable.findFirst({ where: eq(publicToken, ...) })` e re-aplicar `withTenant(store.id, …)` no UPDATE. Custo: 1 round-trip extra. Benefício: defesa em profundidade.

#### C4 — `keep-alive` usa `db` (vitre_app)

- **Arquivo**: `src/app/api/cron/keep-alive/route.ts:27`
- Se a role `vitre_app` for revogada por engano (drift Supabase), keep-alive falha junto e Supabase auto-pausa em 7 dias.
- **Correção**: usar `serviceDb` (role postgres) para o ping. SELECT 1 não toca tenant data.

#### C5 — `mark-whatsapp-opened` Zod é inline (não em schema.ts)

- **Arquivo**: `src/actions/order/mark-whatsapp-opened.ts:30-36`
- Convenção CLAUDE.md #2: schemas vivem em `actions/*/schema.ts`. Inconsistência menor.

#### C6 — Drift schema/migrations 0008

- Última migration `0008_next_professor_monster.sql` adiciona `composition`, `modeling`, `lining`, `washing` em product e `axis`, `colorHex` em variant — bate com o schema do `product/schema.ts`. Sem drift aparente. Memory `db-migrations-discipline` confirma cleanup recente.

---

## Verificação independente — pontos da request

### 1. withTenant compliance

**Confirmado**. Grep `db\.(insert|update|delete|select)` em `src/actions` retornou ZERO matches. Todas as queries vão por `tx` dentro de `withTenant`/`withServiceRole`.

### 2. Zod nos boundaries

**Confirmado** com 1 exceção: `uploadCategoryImage` (achado A4). Todas as outras têm `safeParse`/`parse` no início.

### 3. Error handling

**Padrão Result `{ ok: true } | { ok: false; error }` é uniforme**. Algumas variantes ricas (`fieldErrors` em store/update, product/update, banner/update, category/create-update; `errorCode` em order/create-from-cart). Não há action que `throw` em vez de retornar.

### 4. Idempotency

- ✅ `createOrderFromCart`: UNIQUE `(storeId, idempotencyKey)` + handling de `order_store_idempotency_unique` violation no `catch` retorna o existente. Race blindada.
- ✅ `createDraftProduct`: reusa rascunho < 24h sem nome E sem imagens (linha 64-87).
- ✅ Upload product/banner: count atômico em transação + UNIQUE (productId, position) handle.
- ⚠️ `signUp`/`signIn`: rate limit por IP cobre flood; Better Auth gere session.

### 5. Authorization

**Confirmado**. Toda action admin: `getSession` → `getCurrentStore(userId)` → `withTenant(store.id, userId)`. Tenant ownership amarrado pelo OWNER do user (`storeTable.ownerId = userId`), nunca por id da loja vindo do client.

### 6. Rate limit

5 buckets bem desenhados. Falha graceful do Upstash não tratada (B3). Limites por IP (auth/order/publicApi) e por user (mutation/upload) — escolha correta.

### 7. revalidateTag e cache

**Confirmado**. Toda mutação que toca catálogo/storefront chama `revalidateTag(\`store-\${slug}\`)`. Mutações admin chamam `revalidatePath` específico. Auditei 27 actions de mutação.

### 8. WhatsApp escape

**Confirmado seguro**. `escapeWhatsAppFormatting` em `whatsapp-message.ts:51-57` cobre `*_~\``. Aplicado em customerName, productName, variantName, customerNotes, storeName.

### 9. Email Resend

- Templates HTML com `escapeHtml` em todos os interpolation points (title, body, ctaUrl, ctaLabel).
- `sendResetPassword` é callback do Better Auth — token é gerado/validado pelo BA (single-use por design). 
- Sem rate limit dedicado de envio Resend, mas `requestPasswordReset` está atrás de `rateLimits.auth` (10/10min/IP).

### 10. Crons

- ✅ `expire-orders`: header validado com `timingSafeEqual` + idempotência via optimistic lock + transações independentes por candidato + revalidate por loja afetada.
- ⚠️ `keep-alive`: header validado com `===` (achado A2).
- Ambos são `dynamic = "force-dynamic"` + `runtime = "nodejs"`.

### 11. PII

- ✅ `/p/[token]/page.tsx` NÃO renderiza customerName/customerPhone/customerNotes — só logo, nome da loja, items, total, status, shortCode.
- ⚠️ `getOrderByPublicToken` retorna esses campos no payload (achado B2 — defesa em profundidade).
- Admin pages renderizam PII por design (lojista atende cliente).

### 12. Better Auth gotchas

- ✅ `nextCookies()` é o ÚLTIMO plugin (linha 106).
- ✅ Reset password fluxo cobre token expira/single-use via Better Auth.
- ✅ Admin layout: `requireSession()` + `getCurrentStore` + redirect; correto.

### 13. Connection pool

**Discrepância com memory**: código está `max: 10` em ambos os pools. Memory afirma `max: 1`. Ver achado A1.

### 14. Migrations vs schema drift

Schema Drizzle bate com migration 0008 (auditei colunas adicionadas). Sem drift aparente.

---

## Recomendação prioritária

**Antes de divulgação pública**, corrigir nesta ordem:

1. **A1** — pool `max: 1` (5 min de mudança).
2. **A4** — Zod em uploadCategoryImage (5 min).
3. **A2** — timingSafeEqual em keep-alive (5 min).
4. **B5** — rate limit em delete-image (2 min).
5. **B3** — fail-open em checkRateLimit (15 min, requer logger).
6. **A3** — `requireEmailVerification: true` (depende de domínio próprio + Resend verificado).

**Pré-Fase 2** (escala):

7. **B1** — `withTenant` em createOrderFromCart pós-resolução de slug.
8. **B2** — projeção `PublicOrderView` em order-loader.
9. **B6** — revoke other sessions em resetPassword.
10. **C1** — migrar `console.error` → `logger.error` gradualmente.

**Backlog (cosmético)**: C2, C3, C4, C5.
