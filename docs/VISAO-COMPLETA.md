# MANGOS PAY — Visão Completa & Memória de Execução

> **Documento vivo. Releia no início de toda sessão.**
> Criado 2026-05-22 a partir do diagnóstico Fase 1 + conselho 5 agentes.
> Companheiro do `docs/plano-finalizacao-mangos-pay.md` (técnico). Este é o panorama humano.
>
> **NADA OCULTO.** Todo trabalho, todo pedágio, toda decisão tomada está aqui.

---

## 0. O que o Mangos Pay É (uma frase)

**Sistema de gestão pra lojista pequeno/médio de cidade do interior do Brasil — joia, semijoia, roupa, perfumaria, calçados, acessórios — combinando loja física (PDV balcão), gestão (estoque, financeiro, relatórios) e loja online (catálogo + checkout WhatsApp) num produto só.**

- NÃO emite NF-e (fica em Bling/Tiny do contador)
- NÃO usa Stripe (lojista cobra fora — PIX, cartão, dinheiro, fiado)
- NÃO tem cadastro de cliente final no storefront (carrinho em localStorage)

---

## 1. ESTADO HOJE — o que está rodando

```
┌─────────────────────────────────────────────────────────────────┐
│                     MANGOS PAY (2026-05-22)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ MOTOR (sólido)                ⚠️ PAINEL (mente)             │
│  ────────────────                 ─────────────                │
│  • Banco RLS multi-tenant         • Bugs ativos: estoque,       │
│  • PDV transacional atômico         oversell, relatórios        │
│  • Snapshot histórico               divergentes                 │
│  • 498/498 testes unitários       • Devolução não desconta      │
│  • 39/39 testes integração          em relatório                │
│  • 64/64 SQLs em prod ✅          • Frete entra como receita    │
│  • Deploy Vercel pronto           • Recibo em px (sai feio em   │
│    (sem tráfego real ainda)         jato/laser)                 │
│                                                                 │
│  👻 5 FANTASMAS (admin existe, storefront ignora)               │
│  ────────────────────────────────────────────────               │
│  • COLEÇÃO  → CRUD admin, sem link público                      │
│  • ATRIBUTO → CRUD admin, chips hardcoded no storefront         │
│  • CUPOM    → PDV usa, storefront comenta "ESCONDIDO"           │
│  • RECADO   → action existe, ZERO importação                    │
│  • GRUPO    → CRUD admin, PDV ignora groupId                    │
│                                                                 │
│  🗑️  LIXO RESIDUAL                                              │
│  ─────────────────                                              │
│  • print-layout.tsx (317 linhas, 0 callers)                     │
│  • lib/supabase/server.ts (dep @supabase/supabase-js morta)     │
│  • Pasta /logos raiz (duplica /public/logos)                    │
│  • .claude/worktrees/* + .claude/tmp-build-head/*               │
│  • pdv-shell.tsx 2745 linhas (+591 em 2 semanas)                │
│  • create-balcao-sale.ts 1228 linhas (3 branches duplicados)    │
│  • ReportView × ReportLayout (2 sistemas competindo)            │
│  • PDV /page × new-sale-modal (2 entradas pro mesmo fluxo)      │
│                                                                 │
│  🚫 BLOQUEIOS DA SANDRA (gerente real)                          │
│  ─────────────────────────────────────                          │
│  • Sem importer CSV → 200 SKUs à mão                            │
│  • Sem busca cliente CPF → não acha por documento               │
│  • Devolução só TOTAL → não devolve 1 anel de 3                 │
│  • customer.notes invisível no PDV → libera fiado errado        │
│  • Recibo PX → impressão jato/laser feia                        │
│  • Caixa fechado não bloqueia venda → vendas órfãs no Z         │
│                                                                 │
│  📦 205 ARQUIVOS SEM COMMITAR                                   │
│  ────────────────────────────                                   │
│  Onda 1 + Onda 2 num único bolo. Disco pifa = perde tudo.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Bugs ativos hoje (3, perigosos)

| # | Bug | Onde | Consequência |
|---|---|---|---|
| 1 | Quick form hardcoda `trackStock: false` | `quick-product-form.tsx:100-101` | Vendedora cadastra 50 SKUs sem estoque |
| 2 | `allowOversell` é decorativo no PDV | `create-balcao-sale.ts:688,986` | Switch ligado, PDV bloqueia mesmo assim |
| 3 | `COUNTABLE_STATUSES` divergente | `load.ts:71-72` vs outros loaders | KPI Receita ≠ Relatório oficial |

### Pendência operacional única
- Confirmar `CRON_SECRET` no Vercel ▸ Settings ▸ Environment Variables igual ao `.env.local`

---

## 2. ESTADO DEPOIS — o que vai estar rodando

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANGOS PAY (pós-sprints)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 SANDRA (45 anos, joalheria do interior) — DIA 1             │
│                                                                 │
│   1. Sobe planilha 200 SKUs → cadastrados em 2 min              │
│   2. Sobe 150 clientes → idem                                   │
│   3. Cliente entra no site → vê Vitrine "Lançamentos de Maio"   │
│   4. Cliente filtra "anéis prata" → chips dinâmicos             │
│   5. Cliente vai ao checkout → digita MAIO10 → 10% off          │
│   6. Cliente manda mensagem → vira recado no admin              │
│   7. Sandra abre PDV → busca cliente por CPF → acha             │
│   8. Cliente VIP → preço atacado aplicado automático            │
│   9. Cliente devolve 1 anel de 3 → sistema aceita parcial       │
│  10. Sandra imprime relatório → A4 com CNPJ, valores batem      │
│  11. Manda PDF pro contador → devolução descontada → certo      │
│                                                                 │
│  ✅ Tudo em sincronia. Sem suporte. Sem inconsistência.         │
│                                                                 │
│  ✅ MOTOR                          ✅ PAINEL                    │
│  ────────                          ────────                    │
│  Continua sólido                   Bate com a verdade           │
│                                                                 │
│  ✅ 5 FANTASMAS VIRARAM REAIS                                   │
│  ─────────────────────────────                                  │
│  • COLEÇÃO   → seção visível na home                            │
│  • ATRIBUTO  → chips dinâmicos por loja                         │
│  • CUPOM     → campo input no checkout WhatsApp                 │
│  • RECADO    → formulário "Fale conosco" público                │
│  • GRUPO     → preço atacado aplicado automático no PDV         │
│                                                                 │
│  ✅ LIXO REMOVIDO                                               │
│  ──────────────                                                 │
│  • print-layout morto deletado                                  │
│  • Dep @supabase/supabase-js removida                           │
│  • Pasta /logos raiz removida                                   │
│  • 1 sistema único de impressão                                 │
│  • Constantes centralizadas (sem drift)                         │
│                                                                 │
│  ✅ HISTÓRIA LIMPA                                              │
│  ──────────────                                                 │
│  • 205 arquivos viraram ~20 commits temáticos                   │
│  • git log conta uma história legível                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. AS 7 SPRINTS — cronograma realista (~5-6 semanas)

```
┌──────────────┬───────────────────────────────────────────────┬─────────┐
│   SPRINT     │   OBJETIVO                                    │  TEMPO  │
├──────────────┼───────────────────────────────────────────────┼─────────┤
│ 🟦 SPRINT 0  │ Salvar trabalho + base estável                │  1 dia  │
│ 🟥 SPRINT 1  │ Bugs que quebram dia 1 + base de relatórios   │  3-4d   │
│ 🟧 SPRINT 2  │ Vendas — fluxo de exceção                     │  1 sem  │
│ 🟨 SPRINT 3  │ Clientes + caixa                              │  3-4d   │
│ 🟩 SPRINT 4  │ Relatórios verdadeiros + impressão A4         │  3-4d   │
│ 🟪 SPRINT 5  │ 5 fantasmas viram features reais              │  1 sem  │
│ 🟫 SPRINT 6  │ Limpeza estrutural + smoke prod real          │  2-3d   │
├──────────────┴───────────────────────────────────────────────┴─────────┤
│                  🎉 LOJISTA #1 ENTRA AQUI                              │
├──────────────┬───────────────────────────────────────────────┬─────────┤
│ PÓS-#1 (a)   │ Refator monolitos (pdv-shell, balcao-sale)    │  1 sem  │
│ PÓS-#1 (b)   │ Importer CSV (se necessário)                  │  3-5d   │
│ PÓS-#1 (c)   │ Multi-tenant pleno (signup, subdomínio)       │  1-2sem │
└──────────────┴───────────────────────────────────────────────┴─────────┘
```

---

## 4. TUDO QUE VAI SER FEITO — lista exaustiva (nada oculto)

### 🟦 SPRINT 0 — Higiene & base estável (1 dia) ✅ **FECHADO 2026-05-22 (exceto 0.3)**

Objetivo: zero trabalho perdido, base limpa pra começar.

- [x] **0.1** Rodar `RUN_INTEGRATION=1 npm run test:integration` localmente → confirmar 39/39 com SQL 58 hardened em prod (2026-05-22 — 39/39 ✅)
- [x] **0.2** Fatiar diff de 205 arquivos em ~20 commits temáticos:
  - `chore(db): aplicar SQLs 58-63 + estender check-sql-applied`
  - `feat(estoque): corrigir bug do estoque inicial (Onda 1.1)`
  - `feat(caixa): correção do fechamento Z + 6 tipos de adjustment (Onda 1.2)`
  - `feat(pedidos): recibo + listagem + modal multi-pagamento (Onda 1.3)`
  - `feat(pedidos): filtro de data + totalizador + split por método (Onda 1.4)`
  - `chore(infra): vercel.json gru1 + HMAC crons (Onda 1.5)`
  - `perf(relatorios): limites defensivos em queries pesadas (Onda 1.6)`
  - `chore(ui): find/replace vocabulário em 14 telas (Onda 1.7)`
  - `feat(ui): empty states ricos em 6 listas (Onda 1.8)`
  - `feat(produtos): form 5→3 abas + progressive disclosure (Onda 2.1-2.3)`
  - `feat(compras): CTA estoque aponta pra compras como batch (Onda 2.4)`
  - `feat(estoque): saída manual exige motivo (Onda 2.5)`
  - `feat(caixa): banner amarelo + cabeçalho universal impressão (Onda 2.6-2.7)`
  - `feat(ui): b3-btn 44px + asterisco required + H1 padronizado + autosave (Onda 2.8-2.9)`
  - `feat(produtos): glossário estoque + helpbars saneadas (Onda 2.10-2.11)`
  - `feat(pedidos): navegação ao detalhe + badge fiado + quebra caixa (Onda 2.12-2.14)`
  - `feat(produtos): allow_oversell schema + UI (Onda 2.15)`
  - `feat(seguranca): SQL 58 lead anon restrict (Fase 2 Bloco 2)`
  - `feat(brand): rebrand Mangos Pay — sidebar/logos/icons`
  - `docs(plano): diagnóstico Fase 1 + plano blocos A-K + visão completa`
- [ ] **0.3** Confirmar `CRON_SECRET` no Vercel ▸ Settings idêntico ao `.env.local` *(MANUAL — depende do Anderson no painel Vercel)*
- [x] **0.4** `npm test` + `tsc --noEmit` zero warnings (auditoria pré-Sprint 1) (2026-05-22 — 498/498 unit + tsc 0 warnings + 39/39 integration)

### 🟥 SPRINT 1 — Bugs ativos + base de relatórios (3-4 dias) ✅ **FECHADO 2026-05-22**

Objetivo: nenhum bug bloqueante no dia 1 do lojista. Status de pedido como single source of truth.

- [x] **1.1** Deletar `src/components/admin/quick-product-form.tsx` + remover toggle Rápido/Completo em `new-product-form.tsx:83`. Completo já tem 3 abas + autosave = leve o bastante — commit `ffb7478`
- [x] **1.2** `allowOversell` honrado no PDV — `create-balcao-sale.ts:688` e `:986` consultam `product.allow_oversell` antes de lançar `OutOfStockError` — commit `954ddb0`
- [x] **1.3** Criar `src/actions/order/constants.ts` exportando `COUNTABLE_STATUSES` + `RETURNABLE_STATUSES` + `OPEN_STATUSES` + predicados isCountable/isReturnable/isOpen. Importado por: `actions/reports/load.ts`, `load-sales.ts`, `load-top.ts`, `load-margin.ts`, `load-dre.ts`, `record-return.ts`, `order-status-actions.tsx` — commit `28a5d2c`
- [x] **1.4** **Devolução desconta em todos os relatórios** — LEFT JOIN com `order_return_item`, subtrair quantidade × preço_snapshot do faturamento e CMV em: `load-sales.ts`, `load-top.ts`, `load-margin.ts`, `load-dre.ts`. Tipos expandidos com returned* fields. UI dos 4 relatórios mostra "−R$X devolvido" abaixo dos brutos + rodapé líquido — commit `28a5d2c`
- [x] **1.5** Mini-auditoria: 505/505 unit + tsc 0 warnings + 39/39 integration

### 🟧 SPRINT 2 — Vendas: fluxo de exceção (1 semana) ✅ **FECHADO 2026-05-22**

Objetivo: devolução parcial existe. Frete sai de receita. DRE bate.

- [x] **2.1** **Devolução parcial item-a-item** — `record-return.ts` aceita `returnType='partial'` + `items: Array<{orderItemId, quantity}>`. `restockOrderItemsPartial` em `lib/order/restock.ts`. `load-detail.ts` traz `quantityReturned` por item. UI: novo `order-return-dialog.tsx` com tabs Tudo/Alguns itens + checkbox + qty input. order.status só vira 'returned' quando soma das parciais zera saldo. commit `70c6be7`
- [x] **2.2** Devolução com fiado em aberto **guiada** — action retorna `errorCode='PENDING_RECEIVABLE'` + receivableId + remainingInCents. UI mostra subtela com instruções + botão "Abrir fiado" → `/admin/financeiro/receber?receivable={id}`. Sem inline estorno (transação cross-feature insegura). commit `70c6be7`
- [x] **2.3** **Frete sai de "Receita"** no DRE — SQL 65 adiciona `order.shipping_in_cents NOT NULL DEFAULT 0` + CHECK. Schema TS + DRE separam. UI ganha linha "(−) Repasses (frete cobrado do cliente)". PDV ainda não popula (vai 0). commit `5342cc8`
- [x] **2.4** SQL 64: índice trigram em `product_variant.name` — aplicado em prod, sentinela estendida. commit `39a4807`
- [x] **2.5** Mini-auditoria: 513/513 unit + tsc 0 warnings + 39/39 integration + 66/66 SQLs aplicados

### 🟨 SPRINT 3 — Clientes + caixa (3-4 dias) ✅ **FECHADO 2026-05-22**

Objetivo: operadora não trava em fluxo comum de cliente.

- [x] **3.1** **Busca cliente por CPF/CNPJ** — `customer/search.ts` já tratava digits-only via `normalizeDocument`. UI atualizada: placeholder em PDV e customer-link-section indica "nome, telefone ou CPF/CNPJ". commit `6b2c8a0`
- [x] **3.2** `customer.notes` visível no PDV — `CustomerSearchHit` ganha `notes`. PDV mantém `customerNotes` em state. Badge `<details>` "Anotação sobre este cliente" no card de cliente vinculado. commit `6b2c8a0`
- [x] **3.3** Histórico do cliente linka pro detalhe — `edit-customer-form.tsx` muda de `?q={shortCode}` pra `?detail={orderId}` (padrão Onda 2.12). commit `6b2c8a0`
- [x] **3.4** **Filtro "só vendas com fiado pendente"** — toolbar de `/admin/pedidos` ganha botão toggle. URL via `?fiado=pendente`. Filtro EXISTS subquery em `receivable` cujo `paid_at IS NULL`. commit `56c93ff`
- [x] **3.5** Caixa fechado configurável — SQL 66 cria `store.require_open_cash_session BOOL DEFAULT false`. Novo `PdvPolicyCard` em `/admin/configuracoes` + `updatePdvPolicy` action. PDV bloqueia com `CASH_SESSION_REQUIRED` quando setting ativo + sem caixa + mode != 'quote'. commit `6f79e98`
- [x] **3.6** Mini-auditoria: 519/519 unit + tsc 0 warnings + 39/39 integration + 67/67 SQLs aplicados

### 🟩 SPRINT 4 — Relatórios contador-grade + impressão (3-4 dias) ✅ **FECHADO 2026-05-22**

Objetivo: contador fecha o mês sem reabrir Excel.

- [x] **4.1** `<ReportLayout/>` ganha `document` no ReportStoreInfo. CNPJ/CPF nos 5 relatórios A4. `loadStoreInfoForReport` formata CPF/CNPJ. commit `81c0ad5`
- [x] **4.2** Filtro por categoria/marca em `/admin/relatorios/vendas` — `?categoryIds=` + `?brandIds=` (CSV). EXISTS subquery. Novo `loadReportFilterOptions`. UI: 2 selects. commit `81c0ad5`
- [x] **4.3** Agrupamento por dia — toggle "Agrupar por dia". `GroupedSalesReport` renderiza seção por dia com subtotal + quebra de página. commit `81c0ad5`
- [x] **4.4** Aging 0-30 / 31-60 / 60+ em `/admin/financeiro/receber/relatorio` — coluna "Em aberto há" + 4 cards de aging (current/1-30/31-60/61+). 31-60 amarelo, 61+ vermelho. commit `81c0ad5`
- [x] **4.5** Critério de custeio no rodapé margem — "snapshot histórico, não FIFO ou custo médio". commit `81c0ad5`
- [x] **4.6** Recibo PDV em `?fmt=a4|thermal` — default thermal preserva impressora 80mm. UI com toggle. commit `60a8845`
- [x] **4.7** Fechamento Z em A4 próprio — área "Operador / Conferido por" pra assinatura + rodapé universal. commit `60a8845`
- [x] **4.8** Rodapé universal — `ReportLayout.operatorName`, `loadReportOperatorName`, `counter(page)` via globals.css. 5 A4 + recibo + Z. commits `81c0ad5` + `60a8845`
- [x] **4.9** Mini-auditoria: 527/527 unit + tsc 0 warnings + 67/67 SQLs

### 🟪 SPRINT 5 — 5 fantasmas viram features reais (1 semana) ✅ **FECHADO 2026-05-22**

Objetivo: o que está no admin tem efeito no storefront. Sem feature inerte.

**Ordem do conselho 5 agentes** (retorno comercial primeiro):

- [x] **5.1 CUPOM no checkout** — nova action `validateCouponForPublic` (anon-callable, rate-limited). Campo "Código de desconto" no checkout. `createOrderFromCart` recebe `couponCode` e revalida server-side. Trata errorCode 'COUPON_INVALID' como cupom expirado entre preview e submit. commit `281d582`
- [x] **5.2 RECADO formulário público** — SQL 67 (`lead_source += 'contact_form'`). Nova rota `/[storeSlug]/contato` + action `submitContactMessage`. Link no footer. Admin `/admin/contatos` recebe os recados. commit `281d582`
- [x] **5.3 COLEÇÃO visível na home** — `home-loader` traz collections com `showInHome=true` + count + thumbnail. Novo `CollectionStrip` entre banner e categorias. commit `281d582`
- [x] **5.4 GRUPO afeta PDV** — SQL 68 (`customer_group.default_pricing_tier`). PDV consulta tier via `searchCustomers`, aplica `product.wholesalePriceInCents` em items adicionados. Badge "ATACADO" no card. commit `281d582`
- [x] **5.5 ATRIBUTO chips dinâmicos** — `loadActiveAttributesForStore` retorna atributos + valores com count. `CategoryFilterChips` renderiza chip por valor (swatch quando color). `products-loader` filtra via EXISTS subquery. URL `?attr=<uuid>`. commit `281d582`
- [x] **5.6** Mini-auditoria: 534/534 unit + tsc 0 warnings + 39/39 integration + 69/69 SQLs aplicados

### 🟫 SPRINT 6 — Limpeza estrutural + smoke prod (2-3 dias) ✅ **TÉCNICO FECHADO 2026-05-22 (smoke prod depende do Anderson)**

Objetivo: zero código morto, smoke real com impressora e mobile.

- [x] **6.1** Deletar `src/components/admin/print/print-layout.tsx` (317 linhas, 0 callers em runtime) — commit `8013290`
- [x] **6.2** Deletar `src/components/admin/print/print-store.ts` (helper desatualizado, só importado por print-layout) — commit `8013290`
- [x] **6.3** ~~Deletar `src/lib/supabase/server.ts`~~ **REVOGADO** — grep amplo achou import relativo `./server` em `storage.ts`. NÃO é código morto. Mantido.
- [x] **6.4** Deletar pasta `/logos` raiz (duplicava `public/logos`) — commit `8013290`
- [x] **6.5** Limpar `.claude/worktrees/*` + `.claude/tmp-build-head/` — feito (gitignored, sem impacto no repo)
- [x] **6.6** ~~PDV `/page` vs `new-sale-modal`~~ **REVOGADO** — modal foi decisão CONSCIENTE do founder em 2026-05-21 ("consolidação UX"). Manter ambos por design.
- [x] **6.7** ~~ReportView vs ReportLayout~~ **DEFERIDO** — `ReportView` (443 linhas) ainda mostra breakdown que `RelatoriosIndexCards` não cobre. Refactor fica pra Sprint pós-#1.
- [x] **6.8** `docs/MIGRATION.md` curto — 2 fontes (drizzle vs supabase/sql), drift intencional, workflow, roles, sentinela, recuperação de falha — commit `8013290`
- [ ] **6.9-6.14** Smoke prod L1-L6 (depende do Anderson, runbook em `docs/runbooks/smoke-prod-pre-lojista.md`) — **BLOQUEIA entrada do lojista #1**

### 🎉 LOJISTA #1 ENTRA (via seed/admin manual)

### PÓS-#1 (não bloqueia entrada do primeiro)

- [ ] **PÓS-a** Refator `pdv-shell.tsx` 2745→partes (`usePdvCart`, `usePdvPayments`, `usePdvDiscount`, `<CartList>`, `<PaymentSection>`, `<CustomerPicker>`)
- [ ] **PÓS-b** Refator `create-balcao-sale.ts` 1228→`prepareOrderContext` + `executeStockReservation` + `insertOrderWithRetry`. Sale/Quote/Fiado viram orquestradores ≤50 linhas
- [ ] **PÓS-c** Paralelizar loaders (`/admin/pedidos`, `loadStockKpis`, `loadFullReport`)
- [ ] **PÓS-d** `next/dynamic` em componentes 400+ linhas client-side
- [ ] **PÓS-e** Source maps reais no Sentry (`next.config.ts:139`)
- [ ] **PÓS-f** Subir pool `max: 3 → 10` quando migrar pra Supabase Pro
- [ ] **PÓS-g** Importer CSV produto + cliente (SE lojista chegar com planilha 200+)
- [ ] **PÓS-h** Multi-tenant Bloco 3: tela `/cadastro` self-service + wizard pós-signup
- [ ] **PÓS-i** Multi-tenant Bloco 4: email verification ON + Resend domínio próprio + rate limit signup
- [ ] **PÓS-j** Multi-tenant Bloco 5: middleware subdomínio `{slug}.mangospay.app`

---

## 5. ANTES × DEPOIS — vida do lojista

| Tarefa do lojista                              | HOJE                                | DEPOIS                |
|------------------------------------------------|-------------------------------------|-----------------------|
| Cadastrar 200 produtos                         | Digita 1 a 1 (4h)                   | Sobe CSV (2 min)*     |
| Cadastrar 150 clientes                         | Digita 1 a 1 (3h)                   | Sobe CSV (1 min)*     |
| Buscar cliente pelo CPF                        | Não acha                            | Acha                  |
| Cliente devolve 1 anel de 3                    | Sistema só aceita devolver os 3     | Devolve só 1          |
| Devolução com fiado em aberto                  | Erro técnico, chama dono            | Botão guiado inline   |
| Imprimir relatório pro contador                | Sem CNPJ, valores divergentes       | A4 com CNPJ, bate     |
| Vitrine "Lançamentos" na home                  | Cria no admin, não aparece          | Aparece               |
| Filtro tamanho/cor na storefront               | Chips hardcoded                     | Dinâmico por loja     |
| Cupom MAIO10 no checkout WhatsApp              | Cliente não tem onde digitar        | Digita e aplica       |
| Cliente VIP paga preço de atacado              | Manual no PDV                       | Automático            |
| Cliente devolve, conta certo no faturamento    | Não desconta (mente)                | Desconta              |
| Imprimir recibo em jato/laser                  | Tira estreita no meio da folha A4   | A4 profissional       |
| Operadora cadastra produto rápido              | Sai sem estoque (bug)               | Sai com estoque       |
| Switch "permitir vender zerado"                | Decorativo, PDV bloqueia            | Funciona              |
| Vendas órfãs sem caixa aberto                  | Possível silenciosamente            | Opcional bloquear     |
| Anotação "deve há 3 meses" do cliente          | Invisível no PDV                    | Badge visível         |
| Recado do site → captura de lead               | Formulário não existe               | Existe                |
| Aging de fiado (0-30/31-60/60+)                | Não existe                          | Existe                |
| Relatório por categoria                        | Não existe                          | Existe                |
| Relatório por dia                              | Não existe                          | Existe                |

*pós-#1 se necessário

---

## 6. PEDÁGIOS OCULTOS — coisas que dão errado se esquecer

Tudo que normalmente passa batido e a gente paga depois. **Registrado pra não passar.**

### Schema & DB

- **Sentinela SQL deve cobrir 64+** — atualizar `check-sql-applied.mjs` a cada SQL novo. Hoje cobre 11-63 (64 checks)
- **drizzle/0033 vs supabase/sql/59** — mesma feature em dois lugares. drizzle cria coluna, supabase cria CHECKs. OK funcional, documentar em `docs/MIGRATION.md` (Sprint 6.8)
- **SQL 25 (backfill estoque)** — não tem sentinela porque é condicional. Em DB virgem é OK. Em prod já rodou
- **Trigger `sync_stock_cache_on_movement` agora é SECURITY DEFINER** (SQL 60) — se mexer em RLS de `product`/`stock_movement`, conferir que continua funcionando
- **Backfill quando SPRINT 1.4 entrar (devolução desconta)** — relatórios de períodos passados vão mostrar valores diferentes. Se Anderson já compartilhou KPIs com alguém, documentar

### Testes & CI

- **`RUN_INTEGRATION=1`** roda contra DB real — pré-merge obrigatório quando tocar RLS/schema/role/`withTenant`. CI hoje só faz unit. Sem isso, vazamento de `lead_anon_insert` (corrigido em SQL 58) volta sem aviso
- **Sem framework E2E (Playwright/Cypress)** — costurar 5 fantasmas = 5 smokes manuais a cada deploy. Considerar montar Playwright simples antes da Sprint 5
- **CRON_SECRET no Vercel** — se não bater com `.env.local`, crons retornam 401 silenciosamente. Conferir antes de Sprint 1
- **`vercel.json` regions: ["gru1"]** — confirmar no painel Vercel (declarado no arquivo, mas painel pode override)

### Código

- **Worktrees em `.claude/`** — cópias antigas de `pdv-shell.tsx` em `worktrees/agent-*/` e `tmp-build-head/`. Não vão pro deploy (fora de `src/`) mas confundem `git status`. Limpar na Sprint 6
- **Comentário "5 abas" desatualizado** em `new-product-form.tsx:83` e em JSDoc de `product-form.tsx:172-189` (são 3 abas agora)
- **`product-form.tsx:103-113` tipo `unit`** ainda inclui `pc/cm/m3` (UI removeu mas tipo manteve pra compatibilidade legada — documentar inline)
- **`TAB_FIELDS` em `shared.tsx:239-273`** não inclui `allowOversell` — contador de erro não aponta aba certa se Zod falhar nesse campo
- **`RETURNABLE_STATUSES` hardcoded em 2 lugares** — `order-status-actions.tsx:33` e `record-return.ts:71-74`. Extrair na Sprint 1.3

### UX & Operação

- **Modo Rápido tem bug em produção HOJE** — vendedora cadastra 50 SKUs sem estoque. Sprint 1.1 deleta
- **`allowOversell` é decorativo HOJE** — promessa vazia. Sprint 1.2 corrige
- **Recibo PX gera papel feio em jato/laser HOJE** — Sprint 4.6 corrige
- **Devoluções não descontam HOJE** — faturamento mentindo. Sprint 1.4 corrige
- **`KPI Receita ≠ Relatório vendas` HOJE** — dashboard inclui orçamento/awaiting_whatsapp. Sprint 1.3 corrige
- **`customer.notes` invisível no PDV** — fiado liberado pra inadimplente. Sprint 3.2 corrige
- **Sem aviso ao desativar `trackStock` num produto que tinha estoque** — UI deixa mudar sem confirmar. Pequeno gap, considerar na Sprint 1

### Infra & deploy

- **Smoke prod nunca foi feito** — deploy Vercel está em produção mas sem tráfego real. Bloqueio: impressora real, latência Brasil, 3G mobile. Sprint 6.9-6.14 cobre
- **Lighthouse mobile ≥ 90 nunca medido com dado real** — Sprint 6.14
- **HMAC dos crons em `vercel.json` foi assinado** mas precisa confirmar que `CRON_SECRET` no painel Vercel é o mesmo
- **Sentry source maps são placeholders** — debug em prod fica difícil. PÓS-e

### Decisões em aberto

- **PDV `/page` × `new-sale-modal`** — 2 entradas pro mesmo fluxo. Decidir na Sprint 6.6
- **`ReportView` × `ReportLayout`** — 2 sistemas de relatório. Decidir na Sprint 6.7
- **Importer CSV antes ou depois do lojista #1** — depende do perfil do lojista. Adiado pra PÓS-g
- **Multi-tenant pleno antes ou depois do lojista #1** — adiado pra PÓS-h/i/j

---

## 7. PRINCÍPIOS DE EXECUÇÃO (não esquecer durante as sprints)

1. **Perspectiva do administrador, não do dev** — em toda decisão de UX, pergunto: "uma vendedora de 45 anos consegue?"
2. **Código artesanal** — sem boilerplate genérico, sem soluções "cara de IA", sem abstrações desnecessárias
3. **Removeu feature, removeu lixo junto** — não deixar resíduo
4. **Schema-first** — migration + RLS + CHECK antes da UI
5. **Append-only quando possível** — correção via lançamento reverso, não UPDATE
6. **Snapshot histórico** — custo no momento da venda, preço, nome do cliente
7. **Tudo de mutação é `"use server"`** — client nunca chama Drizzle
8. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público
9. **Vocabulário do varejo BR** — Venda (não Pedido), Vitrine (não Coleção), Filtro (não Atributo), Recado (não Lead)
10. **Densidade utilitária** nas telas de gestão. Brilho só em storefront público / login / onboarding / PDP

---

## 8. SISTEMA DE MEMÓRIA — como manter este documento vivo

### Fluxo

1. **Início de toda sessão**: ler `CLAUDE.md` + `docs/VISAO-COMPLETA.md` + `docs/plano-finalizacao-mangos-pay.md`
2. **Antes de cada Sprint**: revisar checkboxes da Sprint, confirmar pré-requisitos
3. **Durante a Sprint**: marcar `[x]` em cada item conforme fecha, commit logo após
4. **Fim de cada Sprint**: mini-auditoria (`npm test` + `tsc --noEmit` + `RUN_INTEGRATION=1 npm run test:integration`)
5. **Decisão nova/ambígua**: registrar aqui ou em `docs/decisoes/` (se for estrutural)
6. **Item oculto descoberto**: adicionar na seção 6 (Pedágios Ocultos) imediatamente

### Arquivos vivos (releitura obrigatória)

| Arquivo | Quando atualizar | Quem lê |
|---|---|---|
| `CLAUDE.md` | Quando mudar Sprint atual ou regra inquebrável | Toda sessão Claude |
| `docs/VISAO-COMPLETA.md` (este) | A cada Sprint fechada + pedágio descoberto | Anderson + Claude |
| `docs/plano-finalizacao-mangos-pay.md` | A cada item técnico fechado | Claude |
| `docs/auditoria-2026-05-21-pre-lojista-real.md` | Read-only (snapshot do diagnóstico) | Referência |

### Arquivos congelados (não editar)

- `docs/decisoes/` (ADRs 0001-0034)
- `docs/sessoes/` (logs históricos)
- `docs/auditoria-2026-05-21/` (read-only)

---

## 9. HISTÓRICO DE DECISÕES (chronological log)

| Data | Quem | Decisão |
|---|---|---|
| 2026-05-21 | Anderson | Encerrar Fase 1.7 (deploy técnico) sem smoke real. Primeiro lojista entra via signup self-service depois da Fase 2 |
| 2026-05-21 | Anderson | Fase 2 (Multi-tenant) vira Sprint atual. Bloco 1+2 fechados em auditoria |
| 2026-05-22 | Anderson | Pediu auditoria brutal Fase 1 — diagnóstico completo entregue |
| 2026-05-22 | Anderson | **Decisão A**: costurar TODOS os 5 fantasmas (nenhum some) |
| 2026-05-22 | Anderson | **Decisão B**: commit chunked das 205 mudanças, estilo senior |
| 2026-05-22 | Anderson | **Decisão C**: resolver TUDO do diagnóstico, P0+P1 completo, nada oculto |
| 2026-05-22 | Claude | SQLs 58, 59, 61, 62, 63 aplicadas em prod (60 já estava). 64/64 ✅ |
| 2026-05-22 | Conselho 5 | Ordem: K → B+H4+E1 → resto → C reordenado → H+L → lojista #1 → I/G/J pós |
| 2026-05-22 | Conselho 5 | Bloco L novo: smoke prod manual antes do lojista #1 |
| 2026-05-22 | Conselho 5 | C reordenado: C3 (cupom) → C4 (lead) → C1 (coleção) → C5 (grupo) → C2 (atributo) |
| 2026-05-22 | Anderson | Pediu visão completa visual + arquivo de memória — este documento criado |
| 2026-05-22 | Claude | **Sprint 0 fechado**: 4 commits temáticos (chore db, fix pedidos, feat compras, feat produtos). Auditoria final: 498/498 unit + tsc 0 warnings + 39/39 integration. Pendente só 0.3 (CRON_SECRET no painel Vercel — manual). |
| 2026-05-22 | Claude | **Sprint 1 fechado**: 3 commits (`ffb7478` 1.1 quick form removido, `954ddb0` 1.2 allow_oversell honrado, `28a5d2c` 1.3+1.4 constants únicas + devolução desconta nos 4 relatórios). Auditoria: 505/505 unit + tsc 0 warnings + 39/39 integration. Nenhuma SQL nova exigida — schema já tinha tudo desde SQLs 55+62. |
| 2026-05-22 | Claude | **Sprint 2 fechado**: 3 commits (`39a4807` 2.4 SQL 64 trigram, `70c6be7` 2.1+2.2 devolução parcial + fluxo guiado de fiado, `5342cc8` 2.3 SQL 65 shipping no DRE). 2 SQLs novas aplicadas em prod via DIRECT_URL. Auditoria: 513/513 unit + tsc 0 warnings + 39/39 integration + 66/66 SQLs aplicados. |
| 2026-05-22 | Claude | **Sprint 3 fechado**: 3 commits (`6b2c8a0` 3.1-3.3 busca CPF + notes no PDV + histórico linka detalhe, `56c93ff` 3.4 filtro fiado pendente, `6f79e98` 3.5 SQL 66 requireOpenCashSession). 1 SQL nova aplicada em prod. Auditoria: 519/519 unit + tsc 0 warnings + 39/39 integration + 67/67 SQLs aplicados. |
| 2026-05-22 | Claude | **Sprint 4 fechado**: 2 commits (`81c0ad5` 4.1+4.2+4.3+4.4+4.5+4.8 relatórios A4 com CNPJ/filtros/agrupamento/aging/custeio/operador, `60a8845` 4.6+4.7 recibo PDV fmt + Z A4). Auditoria: 527/527 unit + tsc 0 warnings + 39/39 integration + 67/67 SQLs aplicados. |
| 2026-05-22 | Claude | **Sprint 5 fechado**: 1 commit grande (`281d582` 5.1-5.5 cinco fantasmas: cupom no checkout + recado público + coleção na home + grupo no PDV + chips dinâmicos). 2 SQLs novas (67, 68) aplicadas em prod. Auditoria: 534/534 unit + tsc 0 warnings + 39/39 integration + 69/69 SQLs aplicados. |
| 2026-05-22 | Claude | **Sprint 6 técnico fechado**: 1 commit (`8013290` limpeza + MIGRATION.md + runbook smoke). 4 itens deletados (print-layout, print-store, /logos raiz, .claude/worktrees). 3 itens revogados/deferidos com motivo no commit (lib/supabase/server, new-sale-modal, ReportView). docs/MIGRATION.md criado. Smoke prod L1-L6 fica pendente do Anderson (runbook em docs/runbooks/smoke-prod-pre-lojista.md). Auditoria: 534/534 unit + tsc 0 warnings + 39/39 integration + 69/69 SQLs. |

---

## 10. PRÓXIMA AÇÃO (sempre atualizar no fim de sessão)

**▶️ AGORA**: Sprints 0 → 6 (técnico) todas fechadas. **2 bloqueadores manuais antes do lojista #1**:
1. **0.3 / A3** — `CRON_SECRET` no painel Vercel (1 min)
2. **6.9-6.14** — Smoke prod L1-L6 (runbook em `docs/runbooks/smoke-prod-pre-lojista.md`) — exige hardware: impressora real, mobile Android, fotos reais. ~1-2h de execução guiada.

**DEPOIS DOS 2 OK**: lojista #1 entra (Sandra ou outro piloto). Sprints PÓS-#1 (refator pdv-shell + importer CSV + multi-tenant signup) ficam pra fila pós-feedback real.

---

> *"Operável diariamente por uma pessoa de administração — sem ajuda, sem suporte, sem rodeios."*
> — Norte operacional do Mangos Pay, 2026-05-22
