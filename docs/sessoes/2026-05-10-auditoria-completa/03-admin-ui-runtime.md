# Auditoria 03 — Admin UI runtime / hydration / render

**Escopo**: `src/app/(admin)/**`, `src/components/admin/**`. Read-only.
**Build**: verde (35 rotas, todas ƒ dynamic), 1 lint warn (storefront), 1 ts err (test).
**Versão**: Next 15.5.18 + React 19, Tailwind v4.

---

## Resumo executivo — candidatos pro "i" vermelho

Em ordem de probabilidade (a partir de evidência no código):

1. **`useSearchParams()` SEM `<Suspense>` em 3 client components do admin (CLAUDE.md convenção #9 violada)** — `products-filters.tsx`, `products-status-tabs.tsx`, `orders-filters.tsx`. Com Next 15 + parent dynamic, o build NÃO falha (todas as rotas são `ƒ`), mas em **dev mode** o React/Next emite warning runtime do tipo *"missing Suspense boundary with useSearchParams"* a cada render. Isso é exatamente o que alimenta o badge "i" do Next.js Dev Tools (introduzido no 15.4) com **contador vermelho**. Probabilidade alta.
2. **Cobertura zero de `error.tsx` no `(admin)`** — `Onda B` da auditoria já tinha levantado: nenhum `error.tsx` no segmento `(admin)`. Qualquer erro de servidor (ex: query Drizzle falha porque RLS/conexão) explode pra raiz `/error` ou pra _Internal Server Error_. Não é o "i" diretamente, mas amplifica qualquer pequena falha em vermelho irrecuperável.
3. **Toast/sonner**: provavelmente OK — está montado no root layout (não verificado neste escopo, ver auditoria 01/02). Sem evidência de problema.
4. **Hydration mismatch real**: improvável. Único `Date.now()` em render é em `formatRelativeDate` (server component-only consumers). `revenue-chart.tsx` é `"use client"` mas usa `timeZone: "UTC"` consistentemente. `bumpSessionCounter` (sessionStorage) só é chamada em event handler.
5. **Classes Tailwind inexistentes (`bg-vitre-100`, `text-vitre-700`)** em `variant-editor.tsx:102`. Não geram warning em runtime (Tailwind v4 só não emite estilo), mas é débito visual.

**Reprodução do "i" vermelho mais provável**: abrir `/admin/produtos` em dev (`npm run dev`), abrir DevTools → Console. Você verá warning(s) tipo:

```
A param property was accessed directly with `params.<x>`. `params` should be unwrapped with `React.use()`...
```

ou (mais provável aqui):

```
useSearchParams() should be wrapped in a suspense boundary at page "/admin/produtos".
Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
```

Cada warning incrementa o badge do Next Dev Tools. Em runtime de produção isso não aparece — o "i" só rola em dev.

---

## Matriz `error.tsx` / `loading.tsx` / `not-found.tsx`

Inventário completo das rotas em `src/app/(admin)/admin/**`:

| Rota                                  | `page.tsx` | `loading.tsx` | `error.tsx` | `not-found.tsx` |
|---------------------------------------|:----------:|:-------------:|:-----------:|:---------------:|
| `/admin` (layout)                     | layout     | ❌            | ❌          | ❌              |
| `/admin` (home)                       | ✅         | ❌            | ❌          | n/a             |
| `/admin/produtos`                     | ✅         | ✅            | ❌          | n/a             |
| `/admin/produtos/novo`                | ✅         | ❌            | ❌          | n/a             |
| `/admin/produtos/[id]/editar`         | ✅         | ✅            | ❌          | ❌ (usa `notFound()` mas sem custom) |
| `/admin/categorias`                   | ✅         | ❌            | ❌          | n/a             |
| `/admin/banners`                      | ✅         | ❌            | ❌          | n/a             |
| `/admin/configuracoes`                | ✅         | ❌            | ❌          | n/a             |
| `/admin/pedidos`                      | ✅         | ❌            | ❌          | n/a             |
| `/admin/pedidos/[id]`                 | ✅         | ❌            | ❌          | ❌ (usa `notFound()` mas sem custom) |

**Resumo**:
- `error.tsx` no `(admin)`: **0/8 rotas** (incluindo o layout). Toda explosão de RSC sobe pra `_error` global ou tela genérica. Nenhuma chance de retry localizado nem mensagem orientada à Sandra.
- `loading.tsx`: **2/8** (`produtos`, `produtos/[id]/editar`). Outras 6 rotas mostram tela em branco no SSR streaming.
- `not-found.tsx`: 0. As páginas que chamam `notFound()` (editar produto, detalhe pedido) caem no `_not-found` global do projeto.

---

## Achados por severidade

### 🔴 Crítico (afeta UX da Sandra ou pode ser o "i")

#### 🔴 1. `useSearchParams()` SEM `<Suspense>` em 3 client components do admin
**Arquivos**:
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\products-filters.tsx:39`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\products-status-tabs.tsx:42`
- `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\orders-filters.tsx:35`

Cada um chama `useSearchParams()` mas é renderizado direto pela página server sem boundary intermediária:
- `src/app/(admin)/admin/produtos/page.tsx:276,278` renderiza `<ProductsStatusTabs>` e `<ProductsFilters>` sem `<Suspense>`.
- `src/app/(admin)/admin/pedidos/page.tsx:106` renderiza `<OrdersFilters>` sem `<Suspense>`.

CLAUDE.md convenção #9 fala explicitamente disso. Aplicado em `/entrar` e `/redefinir`, esquecido aqui.

**Por que escapou no build**: o segmento `(admin)` inteiro é dynamic (cookies via `requireSession`), então não há prerender estático pra falhar. Mas em **dev mode** Next emite o warning runtime `missing-suspense-with-csr-bailout` a cada request, e em produção o comportamento é "bail to client-side" — o que torna a hidratação mais cara que precisa.

**Correção** (não aplicar agora):
```tsx
import { Suspense } from "react";
// ...
<Suspense fallback={<div className="h-9 w-full animate-pulse bg-muted/30 rounded-md" />}>
  <ProductsFilters categories={filterCategories} />
</Suspense>
```

#### 🔴 2. Zero `error.tsx` em `(admin)`
**Diretório**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\**`

Qualquer falha numa query Drizzle (RLS misconfig, pool exhausted, race em `withTenant`), em `getCurrentStore`, ou um `throw new Error("UNREACHABLE: ...")` (existem 6 desses, ver §6) sobe pra topo. Sem retry, sem orientação.

**Recomendação**: criar `src/app/(admin)/admin/error.tsx` (RC client) com botão "Tentar de novo" + link "Voltar pro painel" + e-mail suporte. Variante por rota só se quiser mensagens específicas.

#### 🔴 3. `throw new Error("UNREACHABLE: ...")` espalhado em 6 server pages
**Arquivos**:
- `src/app/(admin)/admin/page.tsx:86`
- `src/app/(admin)/admin/produtos/page.tsx:63`
- `src/app/(admin)/admin/categorias/page.tsx:16`
- `src/app/(admin)/admin/banners/page.tsx:16`
- `src/app/(admin)/admin/configuracoes/page.tsx:11`
- `src/app/(admin)/admin/pedidos/page.tsx:28`
- `src/app/(admin)/admin/pedidos/[id]/page.tsx:27`

Padrão repetido:
```ts
const store = await getCurrentStore(session.user.id);
if (!store) {
  throw new Error("UNREACHABLE: ... sem loja");
}
```

O layout (`src/app/(admin)/admin/layout.tsx:23`) faz `redirect("/criar-loja/identidade")` antes — em condições normais nunca dispara. Mas se houver race/cache stale com session válida + store ainda não criada, isso explode em runtime e (item 2) cai em error genérico. Bom defensivamente, mas combinado com #2 vira 500 sem rede de proteção. Considerar `redirect()` em vez de `throw` (idêntico em comportamento + telemetria).

---

### 🟠 Alto (não é o "i", mas dev sênior rejeitaria)

#### 🟠 4. `formatRelativeDate` chamado em server components depende de `Date.now()`
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\lib\format.ts:11`

`formatRelativeDate` usa `Date.now() - d.getTime()` e `toLocaleDateString("pt-BR", ...)` sem `timeZone`. Consumidores são server-only (`recent-orders-table.tsx`, `orders-table.tsx`, `order-timeline.tsx`), então:
- **Não há hydration mismatch** (renderização puramente server, output já HTML).
- **Mas**: em Vercel (TZ=UTC), a frase final ("07 mai") depende do TZ do server. Lojista no Brasil vendo `1d` quando ainda é hoje no fuso dela é normal pra deltas curtos, mas a queda pra fallback `toLocaleDateString` (depois de 7d) ignora o fuso da Sandra.

**Correção sugerida**: passar `timeZone: "America/Sao_Paulo"` no fallback, ou — melhor — formatar absoluta no server e relativa no client com `useEffect`. Não bloqueante.

#### 🟠 5. `image-uploader.tsx` revoga blob URL em momento que pode causar broken image flicker
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\image-uploader.tsx:117-121`

Sequência: upload sucesso → `setPendingPreviews(remove)` + `URL.revokeObjectURL(previewUrl)` → server retorna URL real → `onChange(current)` → React re-renderiza substituindo preview por `<Image src={realUrl}>`.

O revoke roda no MESMO setState batch do remove. Se o React não tiver flushado a transição do `<img src={blobUrl}>` antes, browser vê src já revogado → ícone broken por 1 frame. Mitigação possível: revogar com `setTimeout(() => URL.revokeObjectURL(...), 0)` ou em `useEffect`. Baixa frequência mas reproduzível em mobile lento.

**Mesmo padrão**: `store-image-uploader.tsx:67-71` e `category-image-uploader.tsx:63-67`.

#### 🟠 6. Classes Tailwind inexistentes (`bg-vitre-100`, `text-vitre-700`)
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\variant-editor.tsx:102`

```tsx
<span className="bg-vitre-100 text-vitre-700 rounded-full px-2 py-0.5 text-xs font-medium">
  {value.length}
</span>
```

`globals.css` define `--navy-*` e `--brand-store`, NÃO `--vitre-*`. Tailwind v4 com `@theme inline` ignora classes desconhecidas — sem warning, mas o badge fica sem cor.

Outro arquivo afetado: `src/app/(auth)/recuperar/page.tsx` (fora de escopo desta auditoria, registrar).

**Correção sugerida**: trocar por `bg-primary/10 text-primary` (padrão do dashboard).

#### 🟠 7. `<img>` cru em 3 locais do admin (perda de otimização)
**Arquivos**:
- `src/components/admin/products-table.tsx:130` (cover desktop)
- `src/components/admin/products-table.tsx:216` (cover mobile)
- `src/components/admin/image-uploader.tsx:179` (preview pending — defensável, é blob URL)
- `src/app/(admin)/admin/pedidos/[id]/page.tsx:127` (snapshot do produto)

Os covers são URLs do Supabase Storage (já cobertas em `next.config.ts`). Trocar pra `<Image>` com `fill` + `sizes` daria otimização gratuita (canvas-v1 já usa em `categories-admin`, `banners-admin`, `category-image-uploader`).

**Sobre `pedidos/[id]:127`**: snapshot histórico em URL absoluta — esse pode genuinamente ser `<img>` se a URL for de antes do snapshot policy mudar (defensável). Vale comentário no código.

#### 🟠 8. Pluralização incorreta em `produtos/page.tsx:306`
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\produtos\page.tsx:301-306`

```ts
const word = total === 1 ? "produto" : "produtos";
return filtered ? `${total} ${word} encontrado${total === 1 ? "" : "s"}` : `${total} ${word}`;
```

Funciona, mas a forma `"encontrado(s)"` se repete: pra `total=1` vira `"1 produto encontrado"` (✓), pra `total=2` vira `"2 produtos encontrados"` (✓). OK na verdade — falso alarme.

---

### 🟡 Médio (polish)

#### 🟡 9. `OrderTimeline` no detalhe de pedido — sem `aria-current="step"` na etapa current
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\order-timeline.tsx:49-99`

A11y: leitor de tela não sabe qual passo é o atual. Marcar `aria-current="step"` na `<li>` quando `step.state === "current"`.

#### 🟡 10. `AdminPageHeader.subtitle` recebe `<span class="flex">` em pedidos detalhe — é span com display:flex dentro de `<p>` (válido HTML mas estranho)
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\app\(admin)\admin\pedidos\[id]\page.tsx:83-99`

`<p>` permite `<span>` filho, mas `<span>` com flex layout dentro de `<p>` é uma escolha incomum. Eventualmente trocar `<p>` do `page-header.tsx:33` pra `<div>` quando `subtitle` é `ReactNode` complexo, ou aceitar que subtitle aceita só inline simples.

#### 🟡 11. `aria-checked indeterminate` via expressão JS frágil
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\products-table.tsx:85`

```tsx
checked={allSelected || (partialSelected && "indeterminate")}
```

Funciona porque `false || (false && X) === false`, mas é confuso e depende de Radix aceitar `false`/`true`/`"indeterminate"`. Ler pelos próximos seria mais claro:
```tsx
checked={allSelected ? true : partialSelected ? "indeterminate" : false}
```

#### 🟡 12. `WelcomeCard` faz `navigator.share`/`navigator.clipboard` sem gate de feature em SSR
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\welcome-card.tsx:23-45`

`typeof navigator !== "undefined"` é checado uma vez, mas `navigator.clipboard` pode existir em iframe sem permission. `try/catch` cobre — só observação de robustez. OK.

#### 🟡 13. `Pagination.PageLink` rederiva URL no link disabled, sem prevenir click
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\common\pagination.tsx:75-90`

Quando `disabled=true` o componente já renderiza `<Button disabled>` sem `<Link>` (✓). OK.

---

### 🔵 Baixo (nit)

#### 🔵 14. `next/image` `unoptimized` em `banners-admin.tsx:242`
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\banners-admin.tsx:242`

Banners já são pré-comprimidos pelo `sharp` no upload, mas `unoptimized` desabilita TODAS as transformações (resize, formato). Como tem `fill` + `sizes="(max-width: 640px) 100vw, 13rem"`, o ideal seria deixar Next escolher. Trade-off: cada thumbnail no admin custa uma transformação Vercel. Pequeno.

#### 🔵 15. Botão `<button type="button">` em `BannersAdmin` upload trigger correto, mas sem `aria-label`
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\banners-admin.tsx:130-151`

O texto do botão fala "Enviar primeiro banner" / "Enviar outro banner" — leitor de tela já lê ok. Pode adicionar `aria-label` redundante. Skip.

#### 🔵 16. `CategoryDialog` usa `autoFocus` no input
**Arquivo**: `C:\Users\ANDERSON FELIPE\Documents\MODEO\src\components\admin\category-dialog.tsx:131`

`autoFocus` em React tem comportamento inconsistente em SSR; Radix Dialog já gerencia foco do trigger automaticamente. Seguro, mas redundante.

---

## Reprodução do "i" vermelho mais provável

**Hipótese**: `missing-suspense-with-csr-bailout` warning emitido em dev pra cada hit em `/admin/produtos` ou `/admin/pedidos`.

**Como confirmar (founder reproduz)**:
1. `npm run dev`
2. Login em `/admin/produtos`
3. Abrir DevTools → Console (não a Network).
4. Procurar por `useSearchParams() should be wrapped in a suspense boundary` ou `missing-suspense-with-csr-bailout`. Cada warning em dev incrementa o contador do Next Dev Tools (botão "i" no canto inferior).

**Confirmação adicional**: clicar no badge "i" abre o painel de Dev Tools — lista de warnings agrupados por arquivo. Se aparecerem `products-filters.tsx`, `products-status-tabs.tsx`, `orders-filters.tsx`, está confirmado.

**Plano de fix** (não aplicar):
1. Wrap em `<Suspense>` cada um dos 3 client components com searchParams na página que os monta (`produtos/page.tsx`, `pedidos/page.tsx`).
2. Criar `src/app/(admin)/admin/error.tsx` mínimo (boundary cliente com retry).
3. Adicionar `loading.tsx` nas 6 rotas faltantes — mesmo skeleton template já tem em `produtos/loading.tsx`.

---

## Resumo numérico

- **Páginas admin auditadas**: 8 (1 layout + 7 page).
- **Client components admin auditados**: 23.
- **Server components admin auditados**: 7.
- **`error.tsx` em `(admin)`**: 0 / 8.
- **`loading.tsx` em `(admin)`**: 2 / 8.
- **`useSearchParams` sem Suspense**: 3 client components afetando 2 rotas.
- **`<img>` cru no admin**: 4 ocorrências (2 cover de produto, 1 preview blob, 1 snapshot pedido).
- **Classes Tailwind inexistentes**: 1 par (`bg-vitre-100`, `text-vitre-700`) em 1 local.
- **Hydration risks reais**: 0 confirmados (todos os `Date.now()`/`new Date()` são server-only ou em `useEffect`).
