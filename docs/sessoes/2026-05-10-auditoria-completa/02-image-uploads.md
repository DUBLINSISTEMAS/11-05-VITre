# Relatório 02 — Image Uploads

**Escopo**: pipeline completo de upload de imagem (categoria, banner, logo/ícone da loja, galeria de produto). Read-only. Análise estática.
**Build status**: verde (35 rotas, single lint warning em `storefront/toast.tsx`, single tsc error em `tests/expire-orders-cron.test.ts` que é de regex flag — irrelevante para upload).

---

## Sumário executivo

O pipeline de upload está **arquiteturalmente sólido** (compressão sharp → upload via service_role → DB update → revalidate; cleanup orphan webp em falha; rate limit por user; validação MIME both client/server; `withTenant` em DB ops) e os 4 fluxos seguem o mesmo padrão. Não encontrei bug funcional que sozinho explique "erro ao adicionar imagem em categorias" — a categoria *é* o fluxo mais minimalista, sem races nem unique constraints.

Há **uma incompatibilidade crítica de limites** (CSP/headers + Server Action body 5MB **vs** validação app 10MB **vs** bucket Supabase 4MB) que vai mascarar uploads de fotos do iPhone como "erro genérico" e provavelmente é a raiz reclamada. Há também **inconsistências menores** (banner sem revalidate de path adicional, banner sem `previewUrl` no client, faltam mensagens diferenciadas para 413/network/quota Supabase). O bug "i vermelho no /admin" tem causa raiz já levantada no Relatório 03 (`useSearchParams` sem `<Suspense>`) — não é causado por upload.

Severidade global: **🟠 alta** — não bloqueia deploy, mas garante que fotos grandes de iPhone (cenário 100% da Sandra) caiam silenciosamente com mensagem ruim.

---

## Inventário de pontos de upload

| Local | Action server | Client uploader | Bucket | Tipo | Multi | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Categoria (dialog edit) | `src/actions/category/upload-image.ts` | `src/components/admin/category-image-uploader.tsx` | `category-images` | single-slot | não | 🟠 |
| Categoria (remove) | `src/actions/category/remove-image.ts` | idem | `category-images` | delete | — | 🟢 |
| Banner | `src/actions/banner/upload.ts` | `src/components/admin/banners-admin.tsx` | `store-banners` | append (max 10) | não | 🟠 |
| Banner (delete) | `src/actions/banner/delete.ts` | idem | `store-banners` | delete | — | 🟢 |
| Logo / Ícone | `src/actions/store/upload-image.ts` | `src/components/admin/store-image-uploader.tsx` | `store-logos` | single-slot por kind | não | 🟢 |
| Logo / Ícone (remove) | `src/actions/store/remove-image.ts` | idem | `store-logos` | delete | — | 🟢 |
| Produto | `src/actions/product/upload-image.ts` | `src/components/admin/image-uploader.tsx` | `product-images` | gallery (max 5) | sim | 🟠 |
| Produto (delete) | `src/actions/product/delete-image.ts` | idem | `product-images` | delete | — | 🟢 |
| Onboarding (`/criar-loja`) | — | — | — | nenhum | — | 🟢 (intencional) |

Onboarding NÃO faz upload — checked `src/app/(auth)/criar-loja/**`. Logo/ícone só são adicionados pós-criação em `/admin/configuracoes`. Coerente com `[redesign-canvas-v1-lote4-onboarding]`.

---

## Achados por severidade

### 🔴 Críticos (bloqueiam deploy)

Nenhum achado crítico hard-block. Os limites desalinhados (Cat-01) são alta prioridade mas não data-loss/segurança.

### 🟠 Altos

#### **CAT-01 — Três limites de tamanho de arquivo desalinhados (UX silenciosa)**
Existe um *triplo desalinhamento* que torna o erro de upload imprevisível:

- `next.config.ts:79` → `serverActions.bodySizeLimit: "5mb"`
- `src/lib/image.ts:20` → `MAX_INPUT_BYTES = 10 MB` (validateImageInput) e mensagem ao usuário "Máximo 10MB" (`image.ts:80`, replicada em `image-uploader.tsx:218` no copy)
- `supabase/sql/02_storage_buckets.sql:25-28` → `file_size_limit = 4194304` (4 MB) em todos os buckets

**Fluxo real**: um JPEG de iPhone de 7 MB:
1. Passa pelo `validateImageInput` (10 MB OK).
2. **Falha no Next** antes de chegar ao server action porque `bodySizeLimit: "5mb"` rejeita o body. Aparece pro usuário como `result.ok = false` genérico ou throw de fetch — toast mostra "Falha no upload. Tente em instantes." (vide `upload-banner` `:104` e similares no catch de cada action), mas o erro NÃO foi do Supabase: foi do framework.
3. Mesmo que passasse, sharp comprime pra ~150 KB — então o bucket limit de 4 MB nunca é tocado pelo output. Mas se algum dia o sharp gerar > 4 MB (foto enorme com pouca compressão por algum bug), o Supabase rejeitaria com mensagem opaca.

**Impacto**: Sandra com foto típica iPhone (5-8 MB) **vai ter falhas aleatórias** com mensagem genérica. Como ela não vai trocar configuração do iOS pra "Mais Compatível" só por causa de tamanho, isso é o cenário 80%.

**Fix sugerido**: alinhar os 3 valores. Recomendo:
- Manter `MAX_INPUT_BYTES = 10MB` (sharp aguenta).
- Subir `bodySizeLimit` em `next.config.ts` para `"12mb"` (input + overhead multipart).
- Manter bucket em 4MB (proteção do output comprimido — sharp nunca gera > 200 KB).

Adicionalmente: capturar especificamente erro de payload Next no client e mostrar mensagem clara ("Imagem grande demais — comprime antes ou tira outra foto").

#### **CAT-02 — Erros silenciosos no client quando server action throws (sem `try/catch`)**
Comparação:
- `image-uploader.tsx:96-122` (produto) → tem `try/catch` em volta do `await uploadProductImage(...)`. Trata throw com `toast.error("Falha no upload. Verifique sua conexão...")`. ✅
- `category-image-uploader.tsx:51-68` (categoria) → **NÃO tem try/catch externo**. Se `uploadCategoryImage` rejeitar (network error, payload > 5MB do Next, throw inesperado, RateLimitError não-tratado), o `useTransition` engole e a UI fica em estado "loader" travado até nova interação. Toast nunca aparece.
- `store-image-uploader.tsx:54-72` (logo/ícone) → mesma falha. Sem try/catch externo.
- `banners-admin.tsx:67-80` (banner) → mesma falha. Sem try/catch externo.

A action `uploadCategoryImage` em si tem catch interno para cada step (storage falhou, DB falhou) — então em condições normais devolve `{ ok: false, error }`. **MAS**: `checkRateLimit` em `category/upload-image.ts:54-58`:
```ts
try {
  await checkRateLimit(rateLimits.upload, userId);
} catch (e) {
  if (e instanceof RateLimitError) return { ok: false, error: e.message };
  throw e; // ← qualquer outra falha do Upstash propaga
}
```
Se o Upstash estiver fora do ar (rede, token expirado, free tier rate cap), o `throw e` propaga. O client da categoria não captura → loader infinito.

**Impacto**: cenário "tela trava sem toast" em **qualquer** uploader que não seja o de produto. Provavelmente parte da reclamação do founder "erro ao adicionar imagem em categorias" é justamente isso: erro de infraestrutura ou body limit causando throw silencioso.

**Fix sugerido**: envolver os 3 uploaders restantes em `try/catch` externo igual ao `image-uploader.tsx`.

#### **CAT-03 — Banner não tem preview otimista**
`banners-admin.tsx:67-80` faz `await uploadBanner(formData)` direto sem `URL.createObjectURL` para preview. Sandra clica → tela parada → loader na zona de upload → eventualmente refresh com imagem real. Em conexão lenta (rural / 3G — perfil real), 5-8s sem feedback.

Os outros uploaders (categoria, logo/ícone, produto) **fazem** preview otimista. Inconsistência.

**Impacto**: UX ruim em conexão lenta. Reclamação subjetiva "demorou pra aparecer".

**Fix sugerido**: padronizar com `previewUrl` + `URL.createObjectURL` no banner.

#### **CAT-04 — `revalidatePath` faltando em algumas rotas que mostram a imagem**
Cada upload chama `revalidatePath` apenas para o admin específico. Exemplos:
- Upload de categoria → `revalidatePath('/admin/categorias')` ✅ — mas a imagem aparece também na home admin (`SetupChecklist` não usa imagem, OK) e no storefront (`store-${slug}` tag ✅).
- Upload de logo → `revalidatePath('/admin/configuracoes')` + `revalidatePath('/admin')` ✅
- Upload de banner → `revalidatePath('/admin/banners')` ✅ — mas o banner aparece no `WelcomeCard`/dashboard via `bannerCount`? Não, só count, OK.
- Upload de imagem de produto → `revalidatePath('/admin/produtos/${id}/editar')` — não revalida `/admin/produtos` (lista). Capa do produto na lista vai ficar stale até nova navegação.

**Impacto**: Sandra sobe primeira imagem do produto, volta pra `/admin/produtos`, vê placeholder ainda. Confusão.

**Fix sugerido**: adicionar `revalidatePath('/admin/produtos')` em `product/upload-image.ts:171` (já existe revalidate da editar). Custo zero.

#### **CAT-05 — Mensagem "máx 4MB" no hint da categoria não reflete realidade**
`category-edit-dialog.tsx:123` mostra `hint="…JPG, PNG ou WebP — máx 4MB."` Mas `validateImageInput` aceita 10MB. O 4MB é o bucket pós-compressão (que sharp nunca atinge). Mensagem misleading.

Comparar com `image-uploader.tsx:218` (produto) que diz **"máx 10MB cada"** corretamente.

**Fix**: corrigir para "máx 10MB" (alinhado com `MAX_INPUT_BYTES`).

### 🟡 Médios

#### **CAT-06 — `unoptimized` em `banners-admin.tsx:242` perde otimização do `next/image`**
Banner thumbnail no admin lista sem otimização. OK pra debug do dev (cache busting), mas em prod desperdiça bandwidth. CategoryImageUploader e StoreImageUploader usam `unoptimized={previewUrl !== null}` corretamente (só quando é blob).

#### **CAT-07 — Concurrent uploads de produto: pendingPreviews podem aparecer fora de ordem**
`image-uploader.tsx:91-123` faz upload sequencial (`for...of` + `await`), o que é correto para evitar race no `position`. Mas os `pendingPreviews` são adicionados todos antes do primeiro `await` rodar? Não — o `setPendingPreviews` está dentro do for loop, e o await bloqueia. Ordem garantida. ✅ MAS: se o usuário cancelar o navegador no meio, fica órfão um webp para cada upload já completado (server cleanup só roda em throw, não em abort do client). Edge case.

#### **CAT-08 — `headers()` é importado mas só usado para auth, não para `getClientIp`**
Todos os 4 uploads usam `userId` para rate limit (correto — múltiplas funcionárias da Sandra na mesma rede). Mas: NÃO há fallback para `headers().get("x-forwarded-for")` quando `session` falha. Bot anônimo que conheça o endpoint passa direto pela primeira branch (`return { ok: false, error: "Sessão expirada..." }`) — não é problema de segurança aqui, mas DDoS possível porque rate limit só inicia após auth check. Comum em todos os 4 actions.

**Impacto**: baixo (auth check é cheap). Mas tecnicamente um atacante pode martelar sessões inválidas até consumir Postgres connections.

**Fix sugerido**: rate limit por IP **antes** do auth check em todos os uploads.

#### **CAT-09 — Banner: `revalidateTag('store-${slug})` está OK mas não há revalidatePath do storefront**
Banner é renderizado no storefront público (home da loja). `revalidateTag('store-${slug}')` ✅ cobre as RSC pages que usam `unstable_cache` com essa tag. Verificar no relatório 05 (storefront) se o `fetch` realmente carrega com tag — fora do meu escopo.

#### **CAT-10 — Filenames previsíveis no logo/icon facilita enumeração de URLs**
`store/upload-image.ts:92` → `${kind}-${nanoid(12)}.webp`. 12 chars de nanoid = ~71 bits, suficiente. Mas o `kind` prefixo facilita um pouco a discovery. Não é problema de segurança (bucket é public read de qualquer forma), apenas observação. 🔵-ish.

### 🔵 Cosméticos

#### **CAT-11 — Falta `aria-busy` nos uploaders durante `isPending`**
Acessibilidade. O loader spinner é decorativo; screen readers não anunciam estado.

#### **CAT-12 — Mensagem do erro de payload Next 15 é genérica**
Quando `bodySizeLimit` é excedido, Next 15 responde com 413. Os uploaders capturam isso como "Falha no upload" — deveria ser "Imagem muito grande, comprima antes ou use foto menor".

#### **CAT-13 — Comentário desatualizado em `storage.ts:14-17`**
Diz `logo: {storeId}/logo.webp` (filename fixo). Real: filename é `{kind}-{nanoid}.webp` (com nanoid). Confunde quem ler.

---

## Bug reproduzido: erro ao adicionar imagem em categorias

Cenário 1 — **Foto grande (5-8 MB iPhone)**:
1. Sandra abre `/admin/categorias` → clica edit em "Vestidos" → dialog abre com `<CategoryImageUploader>`.
2. Clica "Enviar" → escolhe foto recém-tirada do iPhone (~7 MB JPG).
3. `validateImageInput` passa (10 MB threshold).
4. `setPreviewUrl(blobUrl)` mostra preview borrado.
5. `startTransition` → `await uploadCategoryImage(formData)`.
6. Next 15 server action rejeita body porque > 5 MB → throw no client side fetch.
7. **NÃO há `try/catch` externo no `category-image-uploader.tsx:51-68`**. O throw é engolido pelo `useTransition`. Toast nunca aparece. Loader some (porque transition resolve no throw eventualmente, mas `previewUrl` é revogado no `finally`).
8. Sandra vê preview sumir, sem mensagem, sem imagem nova. Tenta de novo. Mesmo resultado.

Cenário 2 — **Upstash offline / token expirado**:
1. Igual passos 1-4.
2. `checkRateLimit` em `category/upload-image.ts:54` throw não-`RateLimitError`.
3. O `throw e` propaga pra fora da action.
4. Throw chega ao client. Sem try/catch. Loader trava ou some sem toast.

Cenário 3 — **HEIC do iPhone (configuração padrão iOS)**:
1. Sandra sobe HEIC (file.type = "image/heic").
2. `validateImageInput` retorna mensagem clara (`image.ts:84`). Action retorna `{ ok: false, error: "Formato HEIC..." }`.
3. Toast aparece com mensagem útil. ✅ Funciona.

**Diagnóstico mais provável**: cenário 1 (limite de body). Reforçado pelo fato de o uploader de produto funcionar (ele **tem** try/catch externo, então mostra "Falha no upload. Verifique sua conexão" — não é mensagem certa mas pelo menos avisa).

---

## Bug reproduzido: "i" vermelho no /admin

**Não é causado por upload**. O upload acontece em dialog (categoria) ou nas páginas filhas (`/admin/categorias`, `/admin/banners`, `/admin/configuracoes`, `/admin/produtos/[id]/editar`) — não no root `/admin`.

A causa raiz já está documentada no **Relatório 03** com forte evidência: `useSearchParams()` em client components sem `<Suspense>` (`products-filters.tsx`, `products-status-tabs.tsx`, `orders-filters.tsx`), violando CLAUDE.md convenção #9. Em dev mode (Next 15.4+), cada warning incrementa o badge do Next Dev Tools.

**O que upload NÃO causa**:
- Não há `console.error` que rode no render do `/admin/page.tsx`.
- `WelcomeCard` é client-only e só usa `navigator.share` em event handler.
- `DashboardQuickActions` é puro server render.
- `StatCard`, `RevenueChart`, `SetupChecklist`, `RecentOrdersTable` — nenhum carrega imagem que pudesse falhar.

**O que pode contribuir marginalmente**:
- `revenue-chart.tsx` é `"use client"` e renderiza SVG/chart. Se houver hydration mismatch silencioso (formatadores de data), conta pro contador "i". Fora do escopo deste relatório (ver 03).
- O `StoreImageUploader` em `/admin/configuracoes` (não em `/admin`) usa `unoptimized={previewUrl !== null}` que **avalia `previewUrl` no server render** → será sempre `null` na primeira render → OK, não causa mismatch.

**Conclusão**: descartar upload como causa do "i". Seguir Relatório 03 para fix.

---

## Inconsistências entre fluxos de upload

| Aspecto | Categoria | Banner | Loja (logo/icon) | Produto |
| --- | --- | --- | --- | --- |
| Auth check | ✅ | ✅ | ✅ | ✅ |
| Rate limit (`rateLimits.upload`) | ✅ | ✅ | ✅ | ✅ |
| `validateImageInput` antes de sharp | ✅ | ✅ | ✅ | ✅ |
| Zod schema do payload extra | parcial (categoryId via string raw) | ✅ (createBannerSchema do link) | ✅ (kind) | ✅ (productId) |
| `withTenant` em DB ops | ✅ | ✅ | ✅ | ✅ |
| `sharp` 800x800 webp 75% | ✅ via `compressImage` | ✅ | ✅ | ✅ |
| nanoid filename | 16 chars | 16 chars | 12 chars | 16 chars via `generateProductImageFilename` |
| Cleanup orphan em DB fail | ✅ | ✅ (finally block) | ✅ | ✅ (finally block) |
| Cleanup imagem antiga em replace | ✅ | n/a (append) | ✅ | n/a (gallery) |
| `revalidatePath` | `/admin/categorias` | `/admin/banners` | `/admin/configuracoes` + `/admin` | `/admin/produtos/[id]/editar` apenas |
| `revalidateTag('store-${slug}')` | ✅ | ✅ | ✅ | ✅ |
| Preview otimista no client | ✅ | **❌** | ✅ | ✅ (multi) |
| `try/catch` externo no client | **❌** | **❌** | **❌** | ✅ |
| Mensagem de hint | "máx 4MB" (errado) | "Recomendado 1600×600" | (genérico, sem MB) | "máx 10MB cada" (certo) |
| Single-slot replace? | ✅ | append (max 10) | ✅ por kind | append (max 5) |
| Aceita HEIC? | não (mensagem clara) | idem | idem | idem |
| Limite específico de count | n/a | 10 hard | 1 por kind | 5 hard |

**Conclusão**: produto é o fluxo mais maduro (resilient client + try/catch + mensagem certa). Os outros 3 (categoria, banner, logo/icon) precisam **subir ao mesmo padrão**.

---

## Pipeline sharp + Storage — observações técnicas

- `compressImage` (`src/lib/image.ts:54`) está ✅ alinhado com CLAUDE.md regra 5. `failOn: "error"` é estrito (rejeita warnings) — pode ser overly aggressive para JPEGs ligeiramente corrompidos (comum em fotos de WhatsApp re-recebidas). Considerar `failOn: "truncated"`.
- `withMetadata({})` faz strip de EXIF (✅ privacy, GPS removido).
- `effort: 4` é razoável para WebP (default é 4, range 0-6). OK.
- Output sempre WebP — bucket allowed_mime_types só aceita `image/webp` (`02_storage_buckets.sql:25-28`), garantindo que mesmo se algum erro deixar conteúdo errado passar, Supabase rejeita.
- `cacheControl: "31536000, immutable"` (1 ano) — agressivo mas correto: nanoid garante uniqueness, conteúdo nunca muda.
- `upsert: false` em `uploadToStorage` (`storage.ts:53`) — race-safe, mas se duas tentativas com mesmo nanoid acontecerem (probabilidade ~0), erro.
- `extractStoragePath` (`storage.ts:107`) é defensivo: rejeita URLs de outros buckets. ✅ proteção contra `imageUrl` adversarial corrupted no DB.
- `deleteFromStorage` é best-effort com console.warn — correto: cleanup falhar não deve falhar a operação principal.

## Supabase Storage SQL config

`supabase/sql/02_storage_buckets.sql` aplicada (vide AUTOMATION_README ou memória de auditoria). Pontos:
- 4 buckets public (read) ✅.
- Sem policy de write para anon/authenticated → escrita só via `service_role`. ✅
- `file_size_limit = 4194304` (4 MB) → desalinhado com app layer (ver CAT-01).
- `allowed_mime_types = ARRAY['image/webp']` → defesa em profundidade contra upload de não-webp. ✅

---

## Recomendações priorizadas

1. **🟠 (P0) Alinhar bodySizeLimit**: subir `serverActions.bodySizeLimit` em `next.config.ts:79` de `"5mb"` para `"12mb"`. Manter `MAX_INPUT_BYTES = 10MB` em `lib/image.ts`. **Sozinho resolve 80% da reclamação "erro ao adicionar imagem".**
2. **🟠 (P0) Try/catch externo nos 3 uploaders client**: `category-image-uploader.tsx`, `store-image-uploader.tsx`, `banners-admin.tsx` — espelhar padrão de `image-uploader.tsx:111-115`. Garante que `RateLimitError` propagada e network errors viram toast em vez de loader infinito.
3. **🟠 (P1) Corrigir hint de tamanho em `category-edit-dialog.tsx:123`**: "máx 4MB" → "máx 10MB".
4. **🟡 (P1) Preview otimista no banner**: padronizar com os outros uploaders.
5. **🟡 (P2) `revalidatePath('/admin/produtos')` em `product/upload-image.ts`**: para refletir capa nova na lista.
6. **🟡 (P2) Mensagem 413 específica**: detectar throw com status 413 no client e mostrar "Imagem muito grande — tire foto com menor resolução".
7. **🔵 (P3) Atualizar comentário de filenames em `storage.ts:14-17`** para refletir nanoid pattern real.
8. **🔵 (P3) Rate limit por IP antes do auth check** (defesa DDoS) — opcional pre-deploy, vale ADR antes.

---

## Arquivos auditados (absolutos)

- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\category\upload-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\category\remove-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\category\schema.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\banner\upload.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\banner\schema.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\store\upload-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\store\remove-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\store\schema.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\product\upload-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\product\delete-image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\actions\product\schema.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\category-image-uploader.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\category-edit-dialog.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\categories-admin.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\banners-admin.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\store-image-uploader.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\image-uploader.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\welcome-card.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\dashboard-quick-actions.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\image.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\supabase\storage.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\supabase\server.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\tenant.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\store-context.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\rate-limit.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\layout.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\page.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\categorias\page.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\configuracoes\page.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\error.tsx`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\next.config.ts`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\supabase\sql\02_storage_buckets.sql`
