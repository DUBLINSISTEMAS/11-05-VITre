# 2026-05-20 — Sprint 0, Prompt 7: Dead Code Sweep — Pendências

## O que foi deletado nesta sprint

- `src/components/admin/dashboard/quick-actions.tsx` — substituído pelos
  4 OpCards no novo dashboard (Prompt 5).
- `src/components/admin/dashboard/setup-checklist.tsx` — substituído pela
  remoção do checklist do dashboard (Prompt 5).
- `CommercialFieldsCard` export em `src/components/admin/product-commercial-fields.tsx`
  — versão compat da Onda B.1; Onda B.2 e o refactor de 5 abas (Prompt 6)
  usam IdentityExtraCard/CommercialCard/CostMarginCard direto.
- `FormCard` export em `src/components/admin/product-form/shared.tsx`
  — exportado por engano; ninguém importa. SubCard é o padrão das tabs.

## Pendências identificadas por `npx ts-prune` (NÃO deletadas)

Itens que `ts-prune` lista como dead mas têm padrão de re-export
ambíguo (módulos `index.ts` que reexportam via `export *`, schemas
Zod reutilizados em outras camadas etc.). Cada um precisa de
verificação manual antes de deletar.

### Schemas de actions (provável falso-positivo via index.ts)

- `src/actions/coupon/index.ts`: `loadCoupons`, `upsertCoupon`,
  `deleteCoupon`, `validateCoupon` — usados via `from "@/actions/coupon"`
- `src/actions/customer-group/index.ts`: `loadCustomerGroups`,
  `upsertCustomerGroup`, `deleteCustomerGroup` — idem
- `src/actions/storefront-collection/index.ts`: `loadCollections`,
  `loadCollectionDetail`, `upsertCollection`, `deleteCollection`,
  `setCollectionProducts`, `listProductsForCollectionPicker` — idem

### Tipos derivados de Zod schemas

- `src/actions/attribute/schema.ts`: `setProductAttributeValuesSchema`
- `src/actions/banner/schema.ts`: `CreateBannerInput`
- `src/actions/cash-session/schema.ts`: `OpenCashSessionData`,
  `CloseCashSessionData`, `RecordAdjustmentData`
- `src/actions/category/schema.ts`: `UploadCategoryImageInput`
- `src/actions/customer/schema.ts`: `CreateCustomerData`, `UpdateCustomerData`
- `src/actions/order/schema.ts`: `CartItemInput`
- `src/actions/order/balcao/schema.ts`: `BalcaoItemInput`, `CreateBalcaoSaleParsed`
- `src/actions/product/schema.ts`: `UploadProductImageInput`,
  `DeleteProductImageInput`, `ReorderProductImagesInput`, `ProductFormOutput`
- `src/actions/stock/schema.ts`: `RecordMovementData`
- `src/actions/store/schema.ts`: `UpdatePaymentData`, `UploadStoreImageInput`,
  `RemoveStoreImageInput`
- `src/actions/lead/record.ts`: `recordLead`
- `src/actions/reports/types.ts`: `ReportPeriod`

Vários desses tipos são `z.infer<typeof X>` documentando o contrato da
action. Mesmo "não-importado" pelo `ts-prune`, podem ser parte do
contrato público (formulários client esperam o shape). Avaliar 1 a 1.

### Componentes admin

- `src/components/admin/products-status-tabs.tsx`: `ProductStatusFilter`
  — verificar se ainda há filtro de status na listagem de produtos.

### Lib utilities (provável falso-positivo)

- `src/lib/auth.ts`: `AuthUser`
- `src/lib/business-hours.ts`: `formatDaySummary`, `isOpenNow`, `WEEKDAY_LABEL_SHORT`
- `src/lib/cron-auth.ts`: `signCronUrl`
- `src/lib/format.ts`: `formatStatDelta`
- `src/lib/pricing.ts`: `formatPriceLabel`
- `src/lib/shortcode.ts`: `SHORTCODE_LENGTH`
- `src/lib/whatsapp-message.ts`: `buildOrderMessage`
- `src/db/index.ts`: `serviceDb`, `Database`
- `src/lib/auth-client.ts`: `signIn`, `signUp`, `useSession`, `getSession`

### Componentes de rotas (Next.js)

`ts-prune` lista `default` exports de páginas Next como dead — falso-positivo
porque o Next resolve essas rotas por convenção de arquivo, não por import.
Ignorar:
- `src/app/error.tsx`, `global-error.tsx`, `layout.tsx`, `not-found.tsx`,
  `page.tsx`, `robots.ts`, `sitemap.ts`

## Próximos passos

- Decisão futura (sprint dedicada): pegar a lista acima 1 a 1, verificar
  com `grep -rn "Identificador" src/` se realmente não tem callsite, e
  remover. Tipos `z.infer` que documentam contrato de action ficam mesmo
  que aparentemente "não usados" — preservar até evidência contrária.

## ADR-0019

Apenas verificar que o frontmatter mantém `status: parked`. Sem alterar
conteúdo. Validação manual via `head -20 docs/decisoes/0019-*.md`.
