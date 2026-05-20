# 04 — Segurança

**Escopo:** RLS coverage operacional, queries unsafe (SQL injection), uploads (magic bytes), CORS/CSP/HSTS, rate limit, secrets em código, role escalation.

---

## Resumo

| Dimensão | Status |
|---|---|
| RLS + FORCE em tabelas de domínio | 27/27 ativas |
| Anon grants em tabelas | 0 (storefront passa via app server, sem REST direto) |
| `SECURITY DEFINER` em SQLs | 0 |
| `@ts-ignore` / `any` no código | 0 |
| Secrets hardcoded em código | 0 (todos via `process.env`) |
| CSP headers configurados | sim (strict default-src 'self') |
| HSTS configurado | sim (2 anos com preload) |
| X-Frame-Options + frame-ancestors | DENY + 'none' (clickjacking-proof) |
| Permissions-Policy | camera/microphone/geolocation off |
| Rate limit cobertura | 67 mutation actions; 11 sem rate limit (validados: 3 são reads OK, 5 são types/internal, **3 mutations precisam adicionar**) |
| Magic bytes em uploads | NÃO valida — só MIME do cliente (mitigado por re-encode com sharp) |
| Audit log (audit_event) | NÃO EXISTE (planejado Sprint 6) |

**Veredito:** segurança em **bom estado base** (CSP/RLS/withTenant impecáveis). 3 mutations sem rate limit precisam fix; uploads sem magic bytes é débito conhecido pré-MVP.

---

## 1. RLS e isolamento de tenant

- 27/31 tabelas com `rowsecurity=t` E `forcerowsecurity=t` (forçado mesmo pro owner do schema).
- 4 exceções legítimas: `user`, `session`, `account`, `verification` (better-auth provider — gerencia próprio).
- Todas as queries de domínio passam por `withTenant(storeId, userId, ...)` que faz `set_config('app.current_store_id', storeId, true)` antes da função executar.
- Policies usam `current_setting('app.current_store_id', true)::uuid = store_id` — isolamento garantido pelo PG.
- **anon role não tem grant em nenhuma tabela** — storefront público acessa via app server (role `app_user`), nunca via REST direto.

**Avaliação:** modelo robusto. Próximo a `SECURITY DEFINER`-grade isolation sem usar SECURITY DEFINER.

---

## 2. SQL injection

### 2.1 `sql.raw` no codebase

11 ocorrências, **todas no mesmo arquivo**: `src/app/(admin)/admin/page.tsx` (dashboard de operação).

Padrão:
```ts
sql.raw(String(periodo))
// onde periodo veio de: periodoSchema.parse(sp.periodo)
// e periodoSchema = z.enum(["7", "30", "90"]).catch("30")
```

**Análise:**
- O `periodo` é forçado pelo Zod a ser literalmente `"7"`, `"30"` ou `"90"`.
- Mesmo se o atacante mandar `?periodo='; DROP TABLE x; --`, o `.catch("30")` substitui pelo default.
- **Não há exploit real hoje.**

**MAS:** o padrão é **frágil**. Se alguém amanhã trocar pra `z.string()` sem reler o consumer, vira injection imediatamente.

**Recomendação:** trocar `sql.raw(String(periodo))` por **interval literal estático** (3 branches if/else com 3 strings hard-coded), eliminando o `.raw()` em definitivo.

Esforço: ~30 min refactor.

### 2.2 `${var}` em template strings de `sql`

Todos os outros usos são via template tag `sql\`...\`` do Drizzle, que parametriza automaticamente. Sem injection.

---

## 3. Rate limit cobertura

### 3.1 Análise

67 arquivos de mutation (`"use server"` que não são puramente reads).

**11 sem `checkRateLimit`:**
- 5 são `types.ts` (não são actions — falso positivo).
- 1 é `coupon/internal.ts` (chamada interna servidor-servidor — não precisa).
- 3 são reads explicitamente documentadas: `customer/search.ts`, `product/search-for-pdv.ts`, `search/global.ts` (admin autenticado + RLS).
- 1 é `storefront-collection/index.ts` que tem **3 mutations sem rate limit**: `upsertCollection`, `deleteCollection`, `setCollectionProducts`.

### 3.2 ALTO — Adicionar rate limit em storefront-collection

```ts
// src/actions/storefront-collection/index.ts:170
upsertCollection — falta checkRateLimit
// :270
deleteCollection — falta checkRateLimit
// :298
setCollectionProducts — falta checkRateLimit
```

Esses 3 são autenticados (admin do tenant), então o exploit é interno (loop em UI quebrada, admin malicioso). Risco real é baixo mas a régua "todo mutation tem rate limit" precisa cobrir.

**Esforço:** 5-10 min adicionar `await checkRateLimit(rateLimits.mutation, userId);` nas 3.

---

## 4. Uploads e magic bytes

### 4.1 Pipeline atual

```
client → image-uploader.tsx → compressClientImage (browser-image-compression)
       → action upload → ALLOWED_INPUT_MIMES.includes(file.type)
       → sharp().webp().toBuffer() → Supabase Storage
```

### 4.2 MÉDIO — MIME check confia no cliente

`file.type` vem do browser. Pode ser forjado por curl/Postman.

**Defesa atual:**
1. Lista whitelist `ALLOWED_INPUT_MIMES` (image/jpeg, image/png, image/webp, etc).
2. **sharp re-encoda em WebP** — se input não for imagem real, sharp lança erro. Defesa implícita.

**Defesa que falta:**
- Não há check de **magic bytes** (primeiros 4-8 bytes do arquivo que identificam o formato real).
- Um atacante poderia upar SVG malicioso com MIME `image/png`. Sharp re-encoda só raster, então SVG provavelmente falharia parse — mas seria mais robusto rejeitar antes.

**Mitigação:** sharp + WebP final + storage como public read sem execução. Risco efetivo: **baixo**.

**Recomendação:** adicionar `file-type` (npm) no upload-pipeline. CLAUDE.md já lista isso na Sprint 6.

---

## 5. CSP / HSTS / outros headers

Configurado em `next.config.ts`:

```
Content-Security-Policy:
  default-src 'self'
  script-src 'self' 'unsafe-inline'         ← Next.js inline scripts (SSR)
  style-src 'self' 'unsafe-inline'          ← styled-jsx + tailwind utilities
  img-src 'self' https://*.supabase.co data: blob:
  font-src 'self' data:
  connect-src 'self' https://*.supabase.co https://*.sentry.io
  frame-ancestors 'none'                    ← clickjacking
  form-action 'self'
  base-uri 'self'
  object-src 'none'
  upgrade-insecure-requests

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

**Avaliação:** **senior-grade**. Não há `unsafe-eval`. `frame-ancestors 'none'` + `X-Frame-Options DENY` redundância protetiva. HSTS preload-ready.

Único item pra revisar: `'unsafe-inline'` em script-src/style-src. Inevitável com Next.js SSR + tailwind atualmente, mas seria possível migrar pra CSP nonce — não é prioridade.

---

## 6. Secrets

Zero `apiKey`, `secret`, `token` hardcoded fora de `process.env`.

`.env.local` (não commitado) tem:
- `DATABASE_URL`, `DIRECT_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `SUPABASE_*`
- `UPSTASH_*`
- `SENTRY_*`

Validados via Zod em `src/lib/env.ts` no boot. Falha precoce se algum faltar.

---

## 7. Service role uso

`withServiceRole` (BYPASSRLS) usado em **apenas 2 fluxos**:

1. `src/actions/lead/record.ts` — storefront público anônimo precisa gravar lead antes de saber tenant id (resolve store por slug). Função `recordLead` é nullable (não chamada hoje — debt conhecido).
2. `src/actions/order/create-from-cart.ts` — checkout WhatsApp anônimo (resolução de store por slug, antes de saber tenant id; depois muda pra withTenant pro resto da operação).

**Comentário explícito no código (linha 131):** "Antes a função inteira rodava sob withServiceRole (BYPASSRLS) — 200+ linhas vulneráveis a bug" — foi refatorado pra escopo mínimo. **Senior move.**

---

## 8. Findings com severidade

| # | Severidade | Finding | Ação |
|---|---|---|---|
| 1 | **ALTO** | 3 mutations em `storefront-collection/index.ts` sem rate limit | Adicionar `checkRateLimit` em upsert/delete/setProducts |
| 2 | **MÉDIO** | `sql.raw(String(periodo))` no dashboard (frágil mesmo protegido por Zod) | Refator: trocar por 3 strings hard-coded (eliminar `.raw()`) |
| 3 | **MÉDIO** | MIME check confia no cliente (sem magic bytes) | Adicionar `file-type` no pipeline (planejado Sprint 6) |
| 4 | **MÉDIO** | Sem audit log (`audit_event`) | Planejado Sprint 6 |
| 5 | **BAIXO** | `'unsafe-inline'` em script-src/style-src do CSP | Aceitável com Next.js; melhoria futura com nonce |

**Crítico:** **nenhum.**

---

## 9. Recomendação executiva

**Antes de Sprint 2:** corrigir item #1 (3 mutations sem rate limit) — 10 min. É a única coisa que sai do padrão.

**Item #2 (sql.raw)** vale corrigir junto — 30 min.

**Itens #3, #4 e #5** ficam pra Sprint 6 conforme já planejado em CLAUDE.md.

Backend tem postura defensiva senior-grade. CSP, RLS, HSTS, withTenant em todo domínio, withServiceRole escopado, zero secrets em código. Os achados aqui são tunings, não vulnerabilidades.
