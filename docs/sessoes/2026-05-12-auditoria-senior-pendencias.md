# Auditoria sênior — pendências e débitos arquiteturais

Data: 2026-05-12. Escopo: painel admin, storefront, ações, RLS, schemas, UI.
Excluídos por orientação: ProductDialog estreito, isActive default na criação, dead code de drafts/save-and-create-next, aba "Todos" misturando drafts.

## Críticos (corrigir antes de qualquer outra coisa)

- **`src/components/admin/product-create-gate.tsx:42` + `product-create-button.tsx:37` + `products-table.tsx:279`** — três sites montam `<ProductDialog>` na mesma página `/admin/produtos`. Empty state usa `ProductCreateButton`; lista usa `ProductsTable`; gate de `?novo=1` usa `ProductCreateGate`. Cada um tem seu próprio state local — clicar "Novo produto" no header DEPOIS de chegar via `?novo=1` pode abrir dois dialogs simultâneos (radix permite múltiplos abertos, focus-trap rouba do outro). Consolidar em UM provider/dialog único no `page.tsx`, com estado lifted, ou usar URL state.

- **`src/lib/storefront/products-loader.ts:155-173`** — `promoOnly` query usa `sql\`now()\`` mas o resultado é cacheado por `unstable_cache` com `revalidate: 300`. A janela de promo é decidida no momento do SELECT e o set retornado fica colado por 5min — uma promo que expirou às 10:00:00 continua aparecendo nos filtros `?promo=1` até 10:05. PromoStrip na home (`page.tsx:127`) sofre o mesmo. Corrigir: ou tag-invalidar por cron a cada minuto, ou pular cache quando `promoOnly=true` (filtrar no app-layer com `hasActivePromo` em cima da lista geral cacheada).

- **`src/components/admin/product-dialog.tsx:50-111`** — o `useEffect` tem dep array `[state]` (objeto), o que dispara `loadProductDetail` toda vez que o pai recria o objeto, mesmo com mesmos `mode`/`productId`. `ProductsTable` chama `setDialog({ mode: "edit", productId: id })` que sempre é referência nova; OK aqui. Mas após `router.refresh()` (em `onAfterSave`), o pai re-renderiza, `state` mantém-se mas o useEffect refaz a query inteira do produto recém-salvo. Trocar por `[state.mode, state.mode === "edit" ? state.productId : null]`.

- **`src/lib/store-context.ts:22`** — `withTenant("", userId, ...)` passa `storeId=""` ao GUC `app.current_store_id`. Funciona porque a policy `store_owner_access` só checa `owner_id`, mas se qualquer policy futura usar `current_setting('app.current_store_id')::uuid` (cast UUID), `""` lança `invalid input syntax for type uuid`. Risco oculto que só explode quando alguém adicionar uma policy assim. Usar UUID sentinela `'00000000-0000-0000-0000-000000000000'` ou criar `withOwnerScope(userId, ...)` dedicado que só seta `current_user_id`.

- **`src/components/admin/product-dialog.tsx:154-169`** — `onAfterSave` para `continueCreating` faz `setData(createEmptyProduct(...))` mas o `<ProductForm>` recebe `key={product.id}` (linha 277), e `createEmptyProduct` retorna sempre `NEW_PRODUCT_ID = "new-product"`. Após o primeiro save, a key não muda — RHF não reseta `defaultValues`, lojista vê o produto que acabou de criar nos campos. O `key` precisa ser `tempId()` ou um contador, não constante.

## Importantes (próxima onda)

- **`src/actions/order/create-from-cart.ts:340-470`** — laço de retry de `shortCode` chama `tx.transaction(...)` **dentro** de outra transação (`withTenant`). `pg` cria SAVEPOINT, mas o `OutOfStockError` no inner é tratado dentro do catch externo e faz `return` (linha 437) que retorna do callback do `withTenant`. Isso aborta o tx pai sem rollback explícito do savepoint inner — funcional no `pg` driver, mas frágil. Melhor: erros que devem retornar resultado de erro do usuário ficam **fora** do inner tx (rejeitar antes), e só o decremento de estoque + insert ficam no inner.

- **`src/components/admin/products-table.tsx:62, 188`** — o "Open" kebab da última coluna chama `openEdit(p.id)` em vez de abrir um menu de ações (publish/pause/delete/duplicate). Lojista que clica esperando contextual menu cai direto no dialog. Ou trocar pelo `ProductActionsMenu`, ou renomear aria-label para "Editar".

- **`src/app/(admin)/admin/pedidos/page.tsx:45,52-53`** — busca `q` é `eq(shortCode, q.toUpperCase())`. Cliente que cola código mistura caixas (`abc12`) — vira `ABC12` OK; mas se digitou ID parcial (`b54f`), `eq` exato não casa. Lista de pedidos é pequena por loja — usar `ilike(shortCode, q + "%")` ou OR com `customerName` ilike. Atualmente nome do cliente não é buscável.

- **`src/actions/order/update-status.ts:108-115` vs `mark-whatsapp-opened.ts:79-84`** — `markWhatsAppOpened` faz UPDATE sem optimistic-lock e sem checar status atual. Pedido pode estar `canceled`/`expired` e ainda assim ganhar `whatsappOpenedAt` (analytics polui). Adicionar `AND status IN ('awaiting_whatsapp','confirmed')` no WHERE.

- **`src/actions/product/update.ts:202-238`** — diff de variantes percorre `incomingWithId` em loop UPDATE serial. Para um produto com 20 variantes editadas, são 20 round-trips no mesmo tx. `pg` deprecou paralelas no mesmo client, mas para volumes assim vale `UPDATE ... FROM (VALUES ...)` ou batchar. Não é crítico no MVP (lojista médio tem 3-5 variantes), mas vira problema quando alguém usa 20+ tamanhos.

- **`src/actions/order/create-from-cart.ts:171-201`** — `productIds` e `variantIds` são derivados de input sem deduplicação dentro do laço de validação. Se o cliente manda dois itens do mesmo `productId` com `variantId=null` (não deveria, mas é payload externo), o estoque do produto é decrementado duas vezes (linha 377). O ideal é agregar quantidades por `(productId, variantId)` antes do laço de estoque.

- **`src/components/admin/image-uploader.tsx:109-149`** — `current = images` é "snapshot" do prop no início do handler; loop adiciona ao `current` local e chama `onChange(current)`. Isso funciona para uploads em sequência mas se o usuário deleta uma foto no meio (handleDelete dispara), `current` perde a delete e o próximo `onChange` reescreve o array com a foto deletada presente. Mitigar: mover `setImages` pra dentro do componente (controlled-uncontrolled hybrid) ou guardar refs via `useRef`.

- **`src/lib/storefront/products-loader.ts:286-302`** — `getProductBySlug` cacheia também variantes/imagens (não só os campos `Product`). Quando lojista substitui imagem via `replace-image.ts`, a URL muda mas o tag `store-${slug}` é invalidado — OK. Porém `deleteProductImage` invalida o tag também (`delete-image.ts:104`), mas o PDP pode estar servindo um cache HIT entre invalidar e o próximo request. Sem ETag/last-modified no `next/image`, browser pode pegar URL antiga 404. Adicionar headers anti-cache no Storage ou usar query string com versionhash.

- **`src/actions/product/upload-image.ts:148-180`** — cálculo de `position` é `existing` (count) feito sob `withTenant` — duas uploads simultâneas em transações separadas vão ambas ler o mesmo count antes do INSERT. A unique constraint `product_image_product_position_unique` salva (linha 200 catch), mas o cliente vê erro "Conflito ao salvar" e tem que tentar de novo. Solução robusta: `INSERT ... position = (SELECT COALESCE(MAX(position), -1) + 1 FROM product_image WHERE product_id = ?)` em UMA query, ou usar advisory lock por productId.

- **`src/lib/page-search-params.ts:129-135`** — `idOrNullSchema` aceita qualquer string não-vazia, não valida UUID. Comentário diz "Postgres rejeita malformado no WHERE com erro tratável", mas isso vira 500 + Sentry noise. Adicionar `.refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), ...)` para falhar limpo.

## Cosméticos / convenções

- **`src/actions/product/schema.ts:150-187`** — `productFormSchema` e `updateProductSchema` duplicam DOIS `.refine(...)` idênticos. Mover refines pra função `applyProductRefines<T>(s: ZodObject<T>) => ZodEffects` e chamar nos dois lugares.

- **`src/actions/category/update.ts:148-171`** vs **`src/lib/slug-uniqueness.ts`** — slug-rebuild da categoria está inline em `update.ts`, enquanto produto usa `generateUniqueProductSlug`. Extrair `generateUniqueCategorySlug` paralelo pra simetria.

- **`src/components/admin/product-form.tsx:514-534`** — bloco mobile "Salvar e adicionar outro" inline tem `pt-4 lg:hidden`, e o sticky save mobile abaixo ocupa `fixed`/`sticky` separado. Quando `isDraft=true` em dialog, são DOIS elementos mobile com o mesmo botão. Em rotação landscape com teclado iOS aberto, sobreposição.

- **`src/actions/store/update.ts:96-103`** — `addressState` trata `data.addressState?.trim().toUpperCase() || null` mas o schema já valida `/^[A-Za-z]{2}$/`. A normalização (uppercase) deveria estar no schema (Zod transform), não no action. Schema também não normaliza `slugify` para Instagram handle (`@user` vs `user`).

- **`src/actions/banner/reorder.ts:69-79` e `src/actions/category/reorder.ts:86-96`** — dois reorders fazem UPDATE em loop. Mesma observação do `update.ts` de produto. Para banners (max 10) é cosmético; para categorias com aninhamento (até 50 no schema), vale batch.

- **`src/components/admin/products-table.tsx:140, 226`** — usa `<img>` raw com eslint-disable. Outras telas do admin usam `next/image`. Inconsistência — vale converter para `<Image>` (vê `image-uploader.tsx:249`). Em ambiente de produção sem CDN Vercel, a única vantagem é `priority/lazy` automático.

- **`src/components/admin/bulk-actions-toolbar.tsx:117-128`** — toolbar tem `AlertDialog` aninhado dentro de um container `sticky bottom-4`. Quando AlertDialog abre, ele renderiza num portal — OK. Mas o focus-trap do AlertDialog não devolve foco pro botão "Excluir" original quando o dialog fecha em sucesso (a toolbar some porque `count=0`). Sem return target, foco volta pra body — leitor de tela perde contexto.

- **`src/actions/product/load-detail.ts:46-72`** — `loadProductFormOptions` está marcado `"use server"` mas é só uma leitura — não precisaria ser action, podia ser função importada em RSC. Como o `ProductDialog` é client, faz sentido manter como server function; mas o nome `actions/` é semanticamente "mutação". Mover para `lib/storefront-admin/load-product-options.ts` ou `actions/product/queries.ts`.

- **`src/db/schema/catalog.ts:208`** — `productVariantTable.promoPriceInCents`, `sku`, `attributes`, `isActive` são colunas que **nenhum form do admin edita**. `variantInputSchema` (product/schema.ts:45) não inclui. Ou são feature future-proof não documentada, ou são dead-columns. Decidir e remover, ou expor no editor.

## Sugestões de refatoração

- **Padrão "boilerplate de action"**: cada server action repete `auth → rate-limit → safeParse → getCurrentStore → withTenant`. São ~30 linhas de cerimônia. Extrair um helper `createTenantAction(schema, { rateLimit: rateLimits.mutation }, async ({tx, store, data}) => {...})` corta 80% do código e elimina drift (já se vê: `delete-image.ts` chama rate-limit, `mark-whatsapp-opened.ts` chama diferente, etc).

- **Pattern de `StepResult` interno**: ~10 actions definem `type StepResult = { ok: true; ... } | { ok: false; error: string }` redundantemente para capturar o retorno do `withTenant`. Padronizar em um `type ActionStep<T>` exportado de `lib/action-types.ts`.

- **`unstable_cache` + tag invalidation**: `home-loader.ts`, `store-loader.ts`, `products-loader.ts`, `categories-loader.ts`, `related-products-loader.ts`, `search-loader.ts` repetem o mesmo wrapper `cache(async () => { const c = unstable_cache(...); return c(); })`. Extrair `cachedByStore(keyFn, loaderFn, { revalidate })` helper.

- **Server actions `loadXDetail` deveriam virar RSC reads**: `loadOrderDetail`, `loadProductDetail`, `loadProductFormOptions` são leituras puras. Convidam ao anti-pattern de chamar do client via `await` — atualmente OK porque vivem em dialogs client, mas dilui a regra "mutações server-only". Documentar em `CLAUDE.md` que actions com prefixo `load*` são leituras async pra dialogs e não devem ter side-effects.

- **Storefront product queries não usam `withTenant(storeId, null, ...)` de forma consistente com RLS de policy `public_read_active`**: confirmar (não validei na auditoria) que policy realmente existe para `productImageTable`, `productVariantTable` quando `current_user_id='anonymous'`. Vários loaders apoiam-se em filtros app-layer (`isActive=true`) sob `withTenant(..., null)` — se a policy não cobrir leituras anônimas de `product_variant`, o storefront retornaria 0 variantes silenciosamente.

- **Sentry tagging**: só `admin/error.tsx` tagra `boundary: admin`. Storefront e onboarding não. Padronizar para análise no painel.

- **Pre-deploy ToDo arquitetural**: documentar em ADR a decisão de manter `loadDetail*` em `actions/` (com `"use server"`) vs criar `queries/` separado. Hoje vive misturado, com `actions/product/load-detail.ts` ao lado de `actions/product/update.ts`. Para um dev novo, é confuso.
