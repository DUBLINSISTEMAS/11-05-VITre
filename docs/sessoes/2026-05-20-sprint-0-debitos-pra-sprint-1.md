# 2026-05-20 — Sprint 0 fechada → Débitos para Sprint 1

Pendências identificadas durante a Sprint 0 que ficaram fora de escopo
e foram empurradas para a Sprint 1.

## 1. Seis testes falhando pré-existentes

`npm run test` reporta 222 pass / 6 fail. As 6 falhas existiam ANTES
do batch da Sprint 0 (verificado fazendo stash do trabalho e re-rodando
testes no commit `55c2f56`).

Tests afetados:
- `tests/product-publishability.test.ts` — 5 falhas:
  - "productFormSchema rejects active product with zero price"
  - "productFormSchema allows inactive draft with zero price"
  - "updateProductSchema applies the same publish price rule"
  - "productFormSchema rejects mixed variant axes"
  - "updateProductSchema rejects mixed variant axes too"
- Test 206 — "admin: remove controles fake e links quebrados visíveis"

Sintoma observado: schema reporta erro em `gtin` quando teste espera
erro em `basePriceInCents` — sugere que validação adicionada depois
do teste mudou a ordem dos issues no array.

**Resolução agendada para Sprint 1**: revisão dos testes de pricing e
produto será feita junto com o refator do `createBalcaoSale`. Aproveitar
para atualizar os fixtures e a ordem esperada de validação.

## 2. StockInput readonly em modo edit

CLAUDE.md Prompt 6 especificou que a aba "Estoque" deveria mostrar
"estoque atual readonly com link 'Ver movimentações'". A implementação
da Sprint 0 manteve o input EDITÁVEL (decisão documentada em
`tab-estoque.tsx`).

Motivo: mudar para readonly afeta o fluxo de criação de produto —
lojista precisa setar estoque inicial em algum lugar, e a UX de
"lançamento inicial via /admin/estoque" ainda não existe.

**Resolução agendada para Sprint 1**: fluxo de criação de produto será
revisto junto com integração PDV. Quando "lançamento inicial" como
movimento existir no formulário de novo produto, o campo `stockQuantity`
no form de edição pode virar readonly + link.

Arquivos a tocar quando ativar:
- `src/components/admin/product-form/tab-estoque.tsx` — substituir
  `<StockInput>` editável por readonly + link em modo `!isCreating`
- Possivelmente novo dialog "Lançar movimento inicial" pra modo create
- Server action que sincronize stockQuantity inicial → primeiro
  `stock_movement` type='initial'
