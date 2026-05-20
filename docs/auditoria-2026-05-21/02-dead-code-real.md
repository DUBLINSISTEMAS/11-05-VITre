# 02 — Dead code real

**Escopo:** validar cada candidato do `ts-prune` via search no codebase inteiro pra distinguir falso-positivos (Next.js conventions, re-exports) de dead real.
**Metodologia:** `scripts/validate-dead-code.mjs` indexa 393 arquivos `.ts/.tsx`, busca por `\b{name}\b` em cada um excluindo o arquivo de origem.

---

## Resumo

```
Total candidatos ts-prune:        341
False positives (Next.js routes): 119  (default/metadata/viewport/etc)
False positives (re-exports):     157  (db/schema/index.ts, actions/coupon/index.ts, etc)
False positives (used):            18  (ts-prune leu errado o uso interno do módulo)
Real dead (a investigar):          47
```

Dos 47 reais, há **3 categorias distintas** que exigem tratamento diferente.

---

## Categoria A — DELETAR (24 exports realmente sem propósito)

### A.1 Tipos Zod inferidos sem consumer (`*Input`/`*Data`/`*Output`/`*Parsed`)

Esses tipos são `z.infer<...>` ou `z.input<...>` declarados pra documentar contrato, mas nenhum lugar do código importa.

| Arquivo | Export |
|---|---|
| `src/actions/banner/schema.ts:28` | `CreateBannerInput` |
| `src/actions/cash-session/schema.ts:18` | `OpenCashSessionData` |
| `src/actions/cash-session/schema.ts:61` | `CloseCashSessionData` |
| `src/actions/cash-session/schema.ts:84` | `RecordAdjustmentData` |
| `src/actions/category/schema.ts:69` | `UploadCategoryImageInput` |
| `src/actions/customer/schema.ts:155` | `CreateCustomerData` |
| `src/actions/customer/schema.ts:163` | `UpdateCustomerData` |
| `src/actions/order/schema.ts:78` | `CartItemInput` |
| `src/actions/product/schema.ts:11` | `UploadProductImageInput` |
| `src/actions/product/schema.ts:16` | `DeleteProductImageInput` |
| `src/actions/product/schema.ts:22` | `ReorderProductImagesInput` |
| `src/actions/product/schema.ts:381` | `ProductFormOutput` |
| `src/actions/reports/types.ts:4` | `ReportPeriod` |
| `src/actions/stock/schema.ts:66` | `RecordMovementData` |
| `src/actions/store/schema.ts:164` | `UpdatePaymentData` |
| `src/actions/store/schema.ts:192` | `UploadStoreImageInput` |
| `src/actions/store/schema.ts:197` | `RemoveStoreImageInput` |
| `src/actions/order/balcao/schema.ts:36` | `BalcaoItemInput` |
| `src/actions/order/balcao/schema.ts:97` | `PaymentLineInput` |
| `src/actions/order/balcao/schema.ts:98` | `PaymentLineParsed` |
| `src/actions/order/balcao/schema.ts:110` | `BalcaoMode` |
| `src/actions/order/balcao/schema.ts:314` | `CreateBalcaoSaleParsed` |

**Ação:** remover o `export` (deixar como tipo interno do módulo) OU deletar a declaração.

Decisão: **remover `export`**. Tipos Zod podem voltar a ser úteis se algum dia chamar via cliente, mas hoje só polui IntelliSense.

### A.2 Helpers utilitários sem consumer

| Arquivo | Export | Comentário |
|---|---|---|
| `src/lib/business-hours.ts:26` | `WEEKDAY_LABEL_SHORT` | abreviação dom/seg/ter… que ninguém usa |
| `src/lib/business-hours.ts:105` | `formatDaySummary` | helper que ninguém chama |
| `src/lib/business-hours.ts:117` | `isOpenNow` | check de horário de funcionamento sem consumer |
| `src/lib/format.ts:33` | `formatStatDelta` | delta % pra cards de dashboard, sem chamador |
| `src/lib/pricing.ts:124` | `formatPriceLabel` | versão alternativa de format BRL não usada |
| `src/lib/shortcode.ts:32` | `SHORTCODE_LENGTH` | constante de tamanho que não é referenciada |
| `src/lib/auth.ts:131` | `AuthUser` | type alias `Session["user"]` que ninguém usa |

**Ação:** deletar.

---

## Categoria B — DEAD INTENCIONAL (3 exports — backend pronto aguardando wiring)

Esses são casos onde a função/loader existe mas o frontend ainda não consumiu. Documentado em comentários ou memory team.

| Arquivo | Export | Motivo |
|---|---|---|
| `src/actions/lead/record.ts:58` | `recordLead` | Comentário explícito: "NÃO CHAMADO HOJE (memory team `b34-leads-backend-only-no-storefront-wiring`)". Lista 3 candidatos de wiring no storefront. |
| `src/lib/storefront/banners-loader.ts:38` | `getActiveBanners` | Loader cached preparado pra home pública; provavelmente substituído por load inline. |
| `src/lib/storefront/products-loader.ts:354` | `getRecentProducts` | Loader cached pra home pública; mesmo caso. |

**Ação:** **NÃO DELETAR**. Anotar em `docs/sessoes/2026-05-21-dead-code-cleanup.md` que esses 3 ficam intencionais. Adicionar comentário JSDoc com tag `@deprecated-until-wired` em `getActiveBanners` e `getRecentProducts` (recordLead já tem comentário explícito).

---

## Categoria C — DELETAR componentes UI órfãos (15 exports)

### C.1 product-commercial-fields.tsx (5 sub-cards)

```
src/components/admin/product-commercial-fields.tsx:114  CommercialCard
src/components/admin/product-commercial-fields.tsx:146  CostMarginCard
src/components/admin/product-commercial-fields.tsx:225  InventoryExtraCard
src/components/admin/product-commercial-fields.tsx:312  IdentityExtraCard
src/components/admin/product-commercial-fields.tsx:399  NcmField
```

**Status:** zero imports externos (`grep -rln "from.*product-commercial-fields" src/` retorna vazio).

**Histórico:** Sprint 0/Prompt 6 refatorou `product-form.tsx` em 5 abas (`product-form/tab-*.tsx`). As tabs copiaram a lógica desses sub-cards em vez de importá-los. O arquivo `product-commercial-fields.tsx` ficou órfão.

**Ação:** **DELETAR o arquivo inteiro** `src/components/admin/product-commercial-fields.tsx`.

### C.2 skeletons.tsx (4 skeletons não montados)

```
src/components/storefront/skeletons.tsx:173  HeaderSkeleton
src/components/storefront/skeletons.tsx:191  BottomNavSkeleton
src/components/storefront/skeletons.tsx:207  CartItemSkeleton
src/components/storefront/skeletons.tsx:223  FavoriteItemSkeleton
```

Os outros skeletons do arquivo (`ProductCardSkeleton`, `ProductGridSkeleton`, `HeroCardSkeleton`, `CategoryPillsSkeleton`, `SectionHeaderSkeleton`, `ProductDetailSkeleton`, `SearchBarSkeleton`) ainda são usados. Só esses 4 são órfãos.

**Ação:** deletar os 4 exports e suas funções, manter o arquivo.

### C.3 toast.tsx (2 hooks)

```
src/components/storefront/toast.tsx:159  useCartToast
src/components/storefront/toast.tsx:175  useFavoriteToast
```

**Ação:** deletar os 2 hooks. Provavelmente foram substituídos por `toast.success(...)` direto via `sonner`.

### C.4 products-status-tabs.tsx

```
src/components/admin/products-status-tabs.tsx:22  ProductStatusFilter
```

Tipo exportado mas nenhum consumer. **Ação:** deletar o `export`.

### C.5 auth-client.ts (1 re-export)

```
src/lib/auth-client.ts:19  useSession
```

`useSession` é re-exportado de `better-auth/react` mas ninguém usa o re-export local. **Ação:** remover do re-export agregado.

---

## Categoria D — FALSO POSITIVO residual (5 entradas)

| Arquivo | Export | Motivo |
|---|---|---|
| `src/app/api/auth/[...all]/route.ts:12` | `POST` | Next.js route handler — exporta via convention `export const { GET, POST } = ...` |
| `src/lib/cron-auth.ts:138` | `signCronUrl` | Usado em cron scripts externos (não em src/) |

**Ação:** ignorar, ajustar regex do validator se for fazer auditoria de novo.

---

## Plano de execução proposto

| Onda | Escopo | Risco | Linhas removidas estimadas |
|---|---|---|---|
| **Onda 1** | Cat. A.1 + A.2 (remover `export` de 22 tipos Zod + deletar 7 helpers) | BAIXO | ~80 |
| **Onda 2** | Cat. C.1 (deletar `product-commercial-fields.tsx` inteiro — 441 linhas) | BAIXO | ~441 |
| **Onda 3** | Cat. C.2 + C.3 + C.4 + C.5 (skeletons + hooks + tipo) | BAIXO | ~120 |
| **Onda 4** | Cat. B — anotar TODO `@deprecated-until-wired` nos 3 dead intencionais (não deletar) | ZERO | 0 |

Total estimado: **~640 linhas removidas**, 4 commits, ~30 min de execução.

---

## Findings com severidade

| # | Severidade | Finding | Ação |
|---|---|---|---|
| 1 | **MÉDIO** | 22 tipos Zod inferidos sem consumer poluindo IntelliSense | Onda 1 — remover `export` |
| 2 | **MÉDIO** | `product-commercial-fields.tsx` (441 linhas) órfão após refator Sprint 0 | Onda 2 — deletar arquivo |
| 3 | **MÉDIO** | 7 helpers sem consumer (`isOpenNow`, `formatStatDelta` etc) | Onda 1 — deletar |
| 4 | **BAIXO** | 4 skeletons + 2 hooks + 2 small exports órfãos | Onda 3 — deletar |
| 5 | **INFO** | 3 dead intencionais aguardando wiring (recordLead, getActiveBanners, getRecentProducts) | Onda 4 — anotar |

**Crítico/Alto:** **nenhum.**

---

## Verificação pós-limpeza

Após cada onda:
```
npx tsc --noEmit
npm run test
```
Esperado: zero erros, 254 pass / 6 fail (mesmas 6 pré-existentes).
