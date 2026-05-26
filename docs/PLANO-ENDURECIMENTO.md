# Plano de Endurecimento Mangos Pay — Sprint 0 a 4

> **Contrato operacional vivo.** Iniciado 2026-05-26 após auditoria sênior cruzada (3 agentes paralelos + conselho 5 agentes).
> Objetivo: transformar o Mangos Pay de "MVP solo bem feito" em **SaaS pronto pra 10-15 lojas operando todo dia**, sem mentir nos números, sem cair no pico, sem deixar dinheiro do lojista na mesa.
>
> **Não é roadmap aspiracional. É plano fechado de 4 sprints com Definition of Done escrito por item.**

---

## 1. Contexto e Não-Negociáveis

### 1.1 Sistema hoje (resumo factual)

- **Stack**: Next 15 + React 19 + TS + Drizzle ORM + Supabase Postgres + Better Auth + Supabase Storage + shadcn/ui + Tailwind v4 + Vercel (gru1).
- **Estado base**: 73 SQLs aplicadas, 36 tabelas em prod, 536/576 testes verdes (40 skipped integration RLS), `tsc --noEmit` zero erro, 0 `any` type, 7 TODOs total no repo, 3 `console.log` em src inteiro. **Higiene de código incomum pra projeto solo.**
- **Branch única `main`** após catch-up de 41 commits (D2 desta semana, 2026-05-26).
- **vitre.site production** servindo redesign pixel-perfect + 4 sprints sênior (Vendas, Estoque 1+2, Cadastros 1).

### 1.2 O que está GENUINAMENTE BOM (não vai mexer)

| Item | Por quê é bom |
|---|---|
| RLS multi-tenant | `vitre_app` NOBYPASSRLS + FORCE RLS + WITH CHECK simétrico em 14+ tabelas. SQL 58 fechou vazamento `lead_anon_insert`. Defesa em profundidade real. |
| Append-only | `cash_adjustment`, `order_payment`, `stock_movement`, `receivable_payment` corrigem via lançamento reverso, nunca UPDATE. |
| Snapshot histórico | `order_item.unit_cost_snapshot_in_cents` grava custo no momento da venda. Devolução cross-mês recalcula honestamente. |
| WAC (Custo Médio Ponderado) | `purchase/index.ts:428-439` aplica `(saldo×custo + qty×custo_novo)/(saldo+qty)` com `pg_advisory_xact_lock` por produto. Maduro. |
| Logger estruturado | `lib/logger.ts` JSON namespaced + PII filter + Sentry automático em `error`. |
| Auth + CSP + HSTS | Better Auth + nextCookies Next 15. CSP com `frame-ancestors none`. CRON_SECRET com `timingSafeEqual`. |
| Rate limit + sentinela | Toda mutation server-action chama `checkRateLimit`. Test `rate-limit-coverage.test.ts` falha se nova action esquecer. |
| ISR + revalidateTag | 48 arquivos chamam `revalidateTag('store-${slug}')` após mutação. Consistente. |
| Storefront pixel-perfect | Onda PP1-PP15 + S1-S30 admin redesigned. Storefront com SEO básico OK (generateMetadata por produto, OG, sitemap, JSON-LD). |

### 1.3 Princípios anti-bagunça (regras inquebráveis durante execução)

1. **Definition of Done escrito ANTES de começar item.** Cada feature do plano tem DoD na forma *"feito quando: X verificável, NÃO feito por: tela bonita aparece"*. Sem DoD escrito = não começa.
2. **Time-box rígido por Sprint.** Sprint 0 = 1 dia, Sprint 1 = 5 dias, etc. Descoberta nova durante execução **não entra** na Sprint corrente — vai pro Backlog Sprint 5+ deste documento.
3. **Checkpoint formal ao fim de cada Sprint.** 5 checks obrigatórios: (a) DoD de cada item batido, (b) `tsc --noEmit` zero erro, (c) `npm test` verde, (d) `RUN_INTEGRATION=1 npm run test:integration` 40/40 verde, (e) sync deste documento marcando ✅.
4. **Schema-first.** Migration + RLS + CHECK + integration test ANTES da UI. UI sobre schema incompleto = retrabalho garantido.
5. **Tudo de mutação é server action `"use server"` com Zod no boundary.** Client nunca chama Drizzle. Reads ficam em `load*` (sem side-effect).
6. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
7. **Princípio "funciona ou esconde"** descongelado pós-PP. Feature exposta na UI tem que entregar fluxo ponta-a-ponta, senão remove da UI (rota pode seguir viva por URL).
8. **Sem `window.confirm`/`window.alert`** — usar AlertDialog do shadcn.
9. **Sem `formatBRL` local** — sempre `@/lib/pricing`.
10. **Sem `e.message` cru no client** — mensagem genérica PT-BR + `logger.error` no server.
11. **Sem dead code.** Auditoria de remoção a cada Sprint: imports não usados, exports sem importer, arquivos em `scripts/` órfãos, deps sem caller.

### 1.4 O que define "pronto pra 10-15 lojas operando todo dia"

Lista verificável (sai do conjunto final dos 4 sprints):

- [ ] Lojista BR de cidade do interior consegue se cadastrar sozinho via `/criar-loja/conta` e validar email — sem seed manual
- [ ] Sistema aguenta tráfego de pico (15 lojas × storefront público + admin) sem fila de conexão
- [ ] Atacante tentando hammer `/api/auth/sign-up/email` é bloqueado em ≤5 tentativas/min
- [ ] Lojista não consegue fazer abuso de storage (max produtos, max MB imagem) — limite enforçado server-side
- [ ] DRE não mente: receita − CMV − despesa − taxa real cartão − comissão = lucro operacional honesto
- [ ] Joalheria com mesmo SKU em ouro 18k e banhado vê margens corretas separadas (variante com cost próprio)
- [ ] Lojista com 2 vendedoras vê quem vendeu o quê e quanto cada uma deve receber de comissão
- [ ] Fiado em atraso calcula multa + juros automaticamente — lojista BR para de perder R$ 1.2k/mês
- [ ] Vendedora consegue pausar uma venda quando outro cliente chega (parked sale)
- [ ] Perfumaria pode controlar lote + validade dos cosméticos
- [ ] CI roda integration tests RLS — próximo PR não pode introduzir vazamento cross-tenant sem alarme
- [ ] Sentry tem sourcemaps configurados — debug em prod legível
- [ ] DR documentado com RTO/RPO + script de backup manual semanal

---

## 2. Mapa dos 23 Itens da Auditoria

Origem: 3 agentes paralelos (Arquitetura/Escala, Lógica Varejista, Bugs/Dívida) + Auditoria Relatórios + Conselho 5 agentes. Cada item rastreado com gravidade e a sprint que fecha.

### 2.1 🔴 Bloqueadores (10) — vão virar incidente

| # | Item | Sprint |
|---|------|--------|
| 1 | Pool DB max=3 em serverless vai filar com 15 lojas | **Sprint 0** |
| 2 | `requireEmailVerification: false` permite squat de email | **Sprint 1** |
| 3 | Better Auth catch-all `/api/auth/[...all]` sem rate limit | **Sprint 1** |
| 4 | Zero quota por loja (max produtos, max MB imagem) | **Sprint 1** |
| 5 | DRE mente 10-25% (sem expense, sem taxa real cartão) | **Sprint 2** |
| 6 | Variante sem `cost_price_in_cents` próprio | **Sprint 2** |
| 7 | Lote/validade INEXISTE | **Sprint 3** |
| 8 | `sold_by_user_id` é dívida zumbi | **Sprint 3** |
| 9 | CI não roda integration tests RLS | **Sprint 0** |
| 10 | `SENTRY_AUTH_TOKEN` não setado no Vercel | **Sprint 0** |

### 2.2 🟠 Altos (13) — dor diária / perda silenciosa

| # | Item | Sprint |
|---|------|--------|
| 11 | Multa/juros em fiado INEXISTEM | **Sprint 3** |
| 12 | Margem ignora desconto manual | **Sprint 2** |
| 13 | KPI estoque usa preço-pai pra variante | **Sprint 4** |
| 14 | 5 actions financeiras vazam `e.message` cru | **Sprint 1** |
| 15 | `window.prompt` no estorno | **Sprint 4** |
| 16 | Aging report INEXISTE | **Sprint 3** |
| 17 | Pausa-venda no PDV INEXISTE | **Sprint 3** |
| 18 | Exportar CSV pra contador truncado | **Sprint 4** |
| 19 | `weight_grams` no produto INEXISTE | **Sprint 2** |
| 20 | `attachPrimaryImage` N+1 | **Sprint 1** |
| 21 | `pdv-shell.tsx` 3409 linhas | **Sprint 4** |
| 22 | DR/backup não documentado | **Sprint 1** |
| 23 | Sangria expõe 2 de 6 tipos | **Sprint 3** |

### 2.3 🟡 Médios (relativos à dívida) — entram em Sprint 4 ou Backlog

| Item | Destino |
|------|---------|
| `submitContactMessage` usa `withServiceRole` desnecessariamente | Sprint 4 |
| PWA `sw.js` sem stamp automático | Sprint 4 |
| Cart localStorage sem validação Zod | Sprint 4 |
| Logger sem allow-list de chaves (risco PII) | Sprint 4 |
| shortCode collision via `e.message.includes(...)` | Sprint 4 |
| Devolução cross-mês recalcula DRE de janeiro em março | Backlog (decisão produto) |
| Storefront `getOrderByColumn` em `withServiceRole` | Backlog |
| PWA do storefront INEXISTE | Backlog |
| Bloco 5 multi-tenant routing (`{slug}.vitre.site`) | Backlog |

### 2.4 Auditoria Relatórios (D4-D5 de 2026-05-26)

| Item | Destino |
|------|---------|
| DRE mente sem despesas | **Sprint 2** (fix completo) |
| 3 cards stub "Em breve" no index | **Sprint 4** (remover ou implementar Top-clientes) |
| `/admin/compras` é CRUD, não relatório | Backlog (decisão produto) |
| Page header inconsistente nos 5 relatórios A4 | Sprint 4 |
| Filtros categoria/marca só em Vendas | Sprint 4 |
| Vocabulário drift ("Leads" → "Recados do site") | Sprint 4 |

---

## 3. Sprint 0 — Fundamento (1 dia)

**Objetivo**: instalar 3 gates de infraestrutura que TODAS as sprints seguintes dependem. Sem isso, próximas sprints constroem em areia.

### S0.1 — Pool DB ajustado (0.1d)

**Mudança**: `src/db/index.ts` ajusta `max` dos dois pools.

**DoD**:
- ✅ `db` pool com `max: 5`
- ✅ `serviceDb` pool com `max: 1` (uso raríssimo justifica)
- ✅ Comentário no código explicando a escolha (15 lojas × 4 lambdas warm ≤ ceiling Supabase Free 60)
- ✅ Smoke test manual: `ab -n 100 -c 10 https://vitre.site/dublin-sistemas` sem timeout
- ❌ NÃO feito por: "aumentei e ficou OK na inspeção visual"

### S0.2 — CI roda integration tests RLS (0.5d)

**Mudança**: `.github/workflows/ci.yml` ganha job com Supabase ephemeral + `RUN_INTEGRATION=1 npm run test:integration`.

**DoD**:
- ✅ GitHub Action sobe Postgres + aplica `supabase/sql/*` + seed mínimo
- ✅ Roda os 40 integration tests
- ✅ PR contra `main` com mudança que vaza cross-tenant FALHA na CI
- ✅ Teste de regressão: revert local do SQL 58 → CI quebra
- ❌ NÃO feito por: "configurei o YML"

### S0.3 — Sentry sourcemap (0.2d)

**Mudança**: adicionar `SENTRY_AUTH_TOKEN` no Vercel env vars + `SENTRY_ORG` + `SENTRY_PROJECT`. Verificar `next.config.ts:128-141` upload condicional.

**DoD**:
- ✅ Token setado nas 3 envs Vercel (Production, Preview, Development)
- ✅ Próximo deploy faz upload de sourcemaps (log no build do Vercel confirma)
- ✅ Trigger manual de erro em prod (`throw new Error("sentry-test")` em rota controlada) — stack aparece no Sentry **legível, não minificado**
- ❌ NÃO feito por: "token apareceu na env"

### S0.4 — Checkpoint Sprint 0 (0.2d)

- [ ] Commit + push das 3 mudanças
- [ ] Vercel rebuild + smoke vitre.site
- [ ] Atualizar este documento marcando S0 ✅
- [ ] Memória `auditoria-sistemica-2026-05-26.md` ganha entry "Sprint 0 fechado"

**Total Sprint 0**: 1 dia útil.

---

## 4. Sprint 1 — Endurecimento Produção (4-5 dias)

**Objetivo**: deixar o sistema pronto pra aguentar pico de 15 lojas + atacante real + abuso de storage. Sem isso, primeira lojista que entrar gera incidente em 30 dias.

### S1.1 — Email verification ON (1d)

**Mudança**: `lib/auth.ts` flip `requireEmailVerification: true` + Resend domínio próprio + tela `/verificar-email` + reenvio.

**DoD**:
- ✅ Resend domínio próprio configurado (`noreply@mangospay.app` ou `vitre.site`) com SPF/DKIM
- ✅ Better Auth signup retorna `requiresEmailVerification: true` no payload
- ✅ Login bloqueado até clicar link (mensagem PT-BR: "Confirme seu email")
- ✅ Tela `/verificar-email?token=...` consome token + redireciona pro admin
- ✅ Botão "Reenviar email" funciona com rate limit (1/min/email)
- ✅ Teste manual: criar conta, tentar login, ver bloqueio, clicar link, ver desbloqueio
- ❌ NÃO feito por: "flag flipada"

### S1.2 — Rate limit Better Auth catch-all (0.5d)

**Mudança**: middleware ou wrapper no `toNextJsHandler` que aplica `checkRateLimit` nos endpoints `/api/auth/*`.

**DoD**:
- ✅ `POST /api/auth/sign-up/email` retorna 429 a partir da 6ª request/min por IP
- ✅ `POST /api/auth/sign-in/email` mesma proteção
- ✅ `POST /api/auth/forget-password` mesma proteção
- ✅ Teste manual: `for i in {1..10}; do curl -X POST .../sign-up/email; done` mostra 6× 200 e 4× 429
- ❌ NÃO feito por: "tem rate limit nas server actions"

### S1.3 — Quota por loja (1d)

**Mudança**: schema `store.quota_*` columns + middleware em actions de upload/create-product.

**DoD**:
- ✅ Schema: `store.max_products_count` (default 1000), `store.max_image_mb` (default 2)
- ✅ `actions/product/create.ts` valida `currentCount + 1 <= max_products_count` antes do insert
- ✅ `actions/product-image/upload.ts` valida `fileSizeMb <= max_image_mb`
- ✅ Erro retornado em PT-BR: "Limite de 1000 produtos atingido no seu plano"
- ✅ Teste integration: loja com 1000 produtos, tenta criar 1001 → erro
- ❌ NÃO feito por: "schema tem o campo"

### S1.4 — Sanitize 5 actions com `e.message` cru (0.5d)

**Files**: `receivable/reverse-payment.ts:285`, `receivable/record-payment.ts:266`, `receivable/create-standalone.ts:154`, `order/record-return.ts:589`, `stock/record-physical-inventory.ts:257`.

**DoD**:
- ✅ Substituir `return { ok: false, error: e.message }` por `return { ok: false, error: "Falha ao [ação]. Tente novamente." }`
- ✅ Antes do return, `logger.error("[event]", { err: e, ...context })`
- ✅ Teste manual: provocar FK violation em estorno → toast PT-BR genérico, log estruturado no console com stack
- ❌ NÃO feito por: "trocou o texto"

### S1.5 — `attachPrimaryImage` migra pra `DISTINCT ON` (0.5d)

**File**: `src/lib/storefront/_shared.ts:38-41` (comentário admite).

**DoD**:
- ✅ Query passa de "SELECT *, FILTER em JS" para `SELECT DISTINCT ON (product_id) ... ORDER BY product_id, position`
- ✅ `EXPLAIN ANALYZE` em loja com 250 produtos × 8 imagens mostra ≤300 rows lidas (não 2000)
- ✅ Teste unit que valida primeira imagem retornada
- ❌ NÃO feito por: "queries são mais rápidas"

### S1.6 — DR doc + script backup (0.5d)

**Mudança**: `docs/dr.md` + `scripts/backup-snapshot.mjs`.

**DoD**:
- ✅ `docs/dr.md` documenta: RTO target (4h), RPO target (24h), passos pra restaurar Supabase do snapshot, contato de emergência (founder)
- ✅ `scripts/backup-snapshot.mjs` faz `pg_dump` via `DIRECT_URL` e salva em `backups/YYYY-MM-DD.sql.gz`
- ✅ Script testado manualmente, dump válido (consegue `psql -f` em DB limpo)
- ✅ `.github/workflows/backup-weekly.yml` agenda execução semanal (artifact retention 30 dias)
- ❌ NÃO feito por: "tem o arquivo"

### S1.7 — Checkpoint Sprint 1 (0.5d)

- [ ] DoD de cada item batido
- [ ] `tsc --noEmit` zero erro
- [ ] `npm test` verde
- [ ] `RUN_INTEGRATION=1 npm run test:integration` 40/40 verde
- [ ] Capacity smoke test: 50 req/s no storefront vitre.site/dublin-sistemas, p95 < 800ms
- [ ] Atualizar este documento marcando S1 ✅

**Total Sprint 1**: 4.5 dias úteis.

---

## 5. Sprint 2 — Honestidade do Dashboard (5-6 dias)

**Objetivo**: lojista olha o dashboard e vê **a verdade**. Receita líquida real, despesas operacionais, comissão deduzida, taxa real do cartão, margem que respeita desconto e variante.

### S2.1 — Schema `expense` (0.5d)

**SQL**: novo `supabase/sql/73_expense_table.sql`. Drizzle schema `src/db/schema/finance.ts`.

**DoD**:
- ✅ Tabela `expense (id uuid pk, store_id uuid fk, category text check, amount_cents int >0, paid_at date, due_date date, supplier_id uuid fk nullable, recurring boolean default false, recurring_day int nullable, notes text, created_by uuid fk, created_at timestamptz)`
- ✅ RLS policies (4: select/insert/update/delete) seguindo padrão Mangos Pay
- ✅ Categoria enum: `rent`, `payroll`, `utilities`, `supplies`, `marketing`, `tax`, `other`
- ✅ Integration test cross-tenant
- ✅ Drizzle schema + Zod schema em `actions/expense/schema.ts`
- ❌ NÃO feito por: "migration aplicada"

### S2.2 — Tela `/admin/financeiro/pagar` (1.5d)

**Mudança**: nova rota + CRUD + filtros.

**DoD**:
- ✅ Listagem com filtros: período (Hoje/7d/Mês/Custom), categoria, pago/pendente
- ✅ Form de novo lançamento com mask R$ + categoria select + data + opção "Repetir mensalmente"
- ✅ "Repetir mensalmente" gera 12 entries no INSERT (não 1 entry "recurring")
- ✅ Edit + delete (delete = audit, não cascade)
- ✅ KPI no topo: "Pago no mês R$ X · Pendente R$ Y"
- ✅ Botão "Exportar CSV" server-side (não trunca)
- ✅ Teste manual: cadastrar aluguel R$ 3500 recurring → 12 entries criadas com `paid_at` distribuído
- ❌ NÃO feito por: "tela aparece"

### S2.3 — DRE com despesas operacionais reais (0.5d)

**File**: `src/actions/reports/load-dre.ts`.

**DoD**:
- ✅ Query inclui `expense WHERE paid_at BETWEEN period`
- ✅ DRE retorna: `gross_revenue, deductions, net_revenue, cmv, gross_margin, operating_expenses (com breakdown por categoria), operational_profit`
- ✅ Card "Lucro operacional" substitui "Lucro bruto" como destaque
- ✅ Warning permanente removido (substituído por "Inclui despesas dos últimos 30 dias" no footer)
- ✅ Teste unit: receita 60k, CMV 30k, despesa 12k → operational_profit = 18k
- ❌ NÃO feito por: "número apareceu"

### S2.4 — Taxa real cartão deduzida da margem (0.5d)

**Mudança**: `store.card_real_fee_bps_*` config + `load-margin.ts` + `load-dre.ts`.

**DoD**:
- ✅ Schema: `store.card_real_fee_bps_credit_1x int default 350` (3,5%), `_credit_2x_to_6x`, `_credit_7x_to_12x`, `_debit`
- ✅ UI em `/admin/pagamento` ganha seção "Taxa real da maquininha" com 4 inputs
- ✅ `load-dre.ts` deduz a taxa real da receita líquida (não a `surchargeInCents` repassada)
- ✅ Venda R$ 100 crédito 12x com taxa 12% mostra "Você recebe R$ 88" no detalhe do pedido
- ✅ Teste unit: 10 vendas R$ 1000 cartão 12x com fee 12% deduzem R$ 1.200 do DRE
- ❌ NÃO feito por: "campo no schema"

### S2.5 — Margem respeita desconto manual (0.3d)

**File**: `src/actions/reports/load-margin.ts`.

**DoD**:
- ✅ Query soma `(price_snapshot - discount) * quantity - cost_snapshot * quantity` (não `price * qty - cost * qty`)
- ✅ Teste unit: produto R$ 200 com desconto R$ 50 venda 1 unidade, custo R$ 100 → margem R$ 50 (não R$ 100)
- ❌ NÃO feito por: "fórmula trocada"

### S2.6 — Variante com `cost_price_in_cents` próprio + WAC variante-aware (2d)

**Mudança crítica**. SQL + schema Drizzle + `purchase/index.ts:428-439` (advisory lock por variante) + backfill de produtos existentes + `load-margin.ts` + KPI estoque.

**DoD**:
- ✅ SQL `74_variant_cost_price.sql`: `product_variant.cost_price_in_cents int` + CHECK ≥ 0 (nullable, herda do produto-pai se null)
- ✅ `purchase/index.ts` aplica WAC no nível de variante quando `purchase_item.variant_id IS NOT NULL`
- ✅ Advisory lock muda de `pg_advisory_xact_lock(product_id)` pra `pg_advisory_xact_lock(variant_id || product_id)`
- ✅ Backfill: produtos com variante e custo único copiam pra todas as variantes (script `scripts/backfill-variant-cost.mjs`)
- ✅ `load-margin.ts` usa `coalesce(variant.cost_price, product.cost_price)`
- ✅ KPI estoque `stock/load.ts:256-273` usa `variant.cost_price` quando disponível
- ✅ UI: form de produto com variantes mostra campo custo na linha da variante (não só preço)
- ✅ Teste integration: anel ouro 18k (cost R$ 600) e banhado (cost R$ 30) mesma SKU → margens corretas separadas
- ❌ NÃO feito por: "coluna adicionada"

### S2.7 — `weight_grams` no produto (0.3d)

**Mudança**: SQL + schema + UI form.

**DoD**:
- ✅ SQL `75_product_weight_grams.sql`: `product.weight_grams numeric(10,3)` nullable, CHECK ≥ 0
- ✅ Form de produto na aba "Identidade" ganha campo "Peso (g)" com mask numérica
- ✅ Lista de produtos mostra peso quando categoria de joia (decisão via `category.requires_weight` ou heuristic)
- ✅ Teste unit: anel 4.2g salva e exibe
- ❌ NÃO feito por: "campo criado"

### S2.8 — Checkpoint Sprint 2 (0.5d)

- [ ] DoD de cada item batido
- [ ] `tsc --noEmit` zero erro
- [ ] `npm test` verde (incluindo novos tests de margem/DRE)
- [ ] `RUN_INTEGRATION=1 npm run test:integration` 40/40 verde
- [ ] Loja teste: cadastrar aluguel + 5 vendas cartão 12x → DRE bate com cálculo manual
- [ ] Atualizar este documento marcando S2 ✅

**Total Sprint 2**: 5.6 dias úteis.

---

## 6. Sprint 3 — Lojista BR Real (5-6 dias)

**Objetivo**: cobrir as dores do dia-a-dia do lojista BR de interior. Loja com 2+ vendedoras consegue comissionar. Fiado em atraso cobra multa+juros. Vendedora pode pausar venda quando outro cliente chega. Perfumaria controla lote.

### S3.1 — `sold_by_user_id` ativo + relatório por vendedora + comissão (2d)

**Mudança**: ativar FK no order + UI no PDV + nova rota `/admin/relatorios/vendedoras`.

**DoD**:
- ✅ `order.sold_by_user_id` populado em todo create-balcao-sale (com fallback ao user logado)
- ✅ PDV exibe seletor "Vendedora" no topo do carrinho quando loja tem `store_membership` > 1
- ✅ Nova rota `/admin/relatorios/vendedoras` lista cada vendedora com: total vendido, ticket médio, comissão devida (baseada em `product.defaultCommissionBps`)
- ✅ Export CSV server-side da rota
- ✅ DRE deduz comissão devida da margem
- ✅ Audit: edição de venda por user diferente do `sold_by` registra `audit_event` "sale.edited_by_other"
- ✅ Teste integration: 2 users, 10 vendas atribuídas, comissão 3% calculada correta
- ❌ NÃO feito por: "campo populado"

### S3.2 — Multa + juros em fiado (1.5d)

**Mudança**: SQL `76_receivable_late_fee.sql` + cálculo + UI.

**DoD**:
- ✅ Schema: `receivable.late_fee_bps int default 200` (2%), `interest_per_month_bps int default 100` (1%/mês), `original_amount_cents int` (pra calcular juros sobre principal, não saldo)
- ✅ `loadReceivableDetail` retorna `current_amount_cents` calculado = principal + (principal × late_fee_bps × 0.0001) + (principal × interest_per_month_bps × meses_atraso × 0.0001) quando `now() > due_date`
- ✅ UI: card de cobrança mostra "Saldo R$ 200 + multa R$ 4 + juros R$ 4 = R$ 208"
- ✅ Configuração em `/admin/pagamento` permite ajustar bps default da loja (com warning legal: "verifique limite legal do seu estado")
- ✅ Recebimento parcial abate primeiro juros, depois multa, depois principal
- ✅ Teste unit: fiado R$ 200 vencido 30 dias atrás → current_amount R$ 206
- ❌ NÃO feito por: "campo no schema"

### S3.3 — Pausa-venda no PDV (1d)

**Mudança**: schema `parked_sale` + UI no PDV + F-keys.

**DoD**:
- ✅ SQL `77_parked_sale.sql`: tabela `parked_sale (id, store_id, user_id, customer_id, items jsonb, parked_at, label text)`
- ✅ PDV F9 = pausar carrinho atual (limpa + grava em `parked_sale`)
- ✅ PDV F10 = lista pausados (modal) → clicar retoma carrinho + apaga linha
- ✅ Auto-expira após 4h (cron noturno OU check no load)
- ✅ Listagem mostra cliente vinculado + total + tempo desde pausa
- ✅ Teste manual: 3 vendedoras pausam venda simultaneamente, retomam alternado
- ❌ NÃO feito por: "tela aparece"

### S3.4 — Lote + validade pra perfumaria (1d)

**Mudança**: SQL `78_purchase_item_batch.sql` + UI compra + alerta.

**DoD**:
- ✅ Schema: `purchase_item.batch_number text nullable`, `purchase_item.expires_at date nullable`. NÃO no produto (porque mesmo SKU pode ter lotes diferentes).
- ✅ UI compra: ao adicionar item, se categoria for "cosméticos/perfumaria" (heuristic OU `category.tracks_batch`), mostra campos batch + validade
- ✅ Dashboard ganha card "Vencendo em 60 dias" com contagem + link pra listagem
- ✅ Listagem: produto, lote, qty restante (calculada via `stock_movement` filtrada por purchase_item_id), vence em X dias
- ✅ FEFO (First-Expired-First-Out) sugestão no PDV: ao vender produto com múltiplos lotes ativos, alerta "Vender lote X primeiro (vence em 30d)"
- ✅ Teste integration: comprar 10un com batch ABC vencendo 2026-08, vender 3 → estoque do lote 7
- ❌ NÃO feito por: "campo gravado"

### S3.5 — Sangria expõe 6 tipos (0.3d)

**File**: `src/components/admin/pdv/cash-adjustment-dialog.tsx` (ou similar).

**DoD**:
- ✅ Select de tipo expõe: Sangria, Reforço, Pagamento de fornecedor, Pagamento de conta, Outra entrada, Outra saída
- ✅ Backend já aceita (`cash_adjustment_type` enum). UI só desbloqueia.
- ✅ Relatório de caixa do dia mostra agrupamento por tipo
- ✅ Teste manual: lançar pagamento de fornecedor R$ 200 → aparece como "Pagamento de fornecedor" no relatório
- ❌ NÃO feito por: "options apareceram"

### S3.6 — Aging report (0.5d)

**Mudança**: nova rota `/admin/estoque/parado` OU tab na rota de estoque atual.

**DoD**:
- ✅ Query usa LATERAL JOIN: pra cada produto, calcula `max(created_at)` em `stock_movement` WHERE `direction='sale'`
- ✅ 3 cohorts: 60-90 dias, 90-180 dias, +180 dias
- ✅ Cada cohort lista produtos ordenados por valor parado (qty × cost) desc
- ✅ KPI no topo: "Capital parado em 60d+ R$ X · 90d+ R$ Y · 180d+ R$ Z"
- ✅ Export CSV server-side
- ✅ Teste integration: produto vendido última vez há 100 dias aparece em cohort 90-180d
- ❌ NÃO feito por: "tela aparece"

### S3.7 — Checkpoint Sprint 3 (0.5d)

- [ ] DoD de cada item batido
- [ ] `tsc --noEmit` zero erro
- [ ] `npm test` verde
- [ ] `RUN_INTEGRATION=1 npm run test:integration` 40/40 verde
- [ ] Cenário E2E: vendedora A registra venda, vendedora B pausa carrinho, dono vê comissão correta no relatório
- [ ] Atualizar este documento marcando S3 ✅

**Total Sprint 3**: 6.3 dias úteis.

---

## 7. Sprint 4 — Refinamentos (4-5 dias)

**Objetivo**: fechar a dívida latente. Refactor de complexidade alta, UX consistente, dead code removido, vocabulário canônico.

### S4.1 — Refactor `pdv-shell.tsx` (2-3d)

**Estratégia conservadora** (não 3409→6 arquivos de uma vez, EXTRAÇÃO MÍNIMA dos hooks).

**DoD**:
- ✅ Hooks customizados extraídos: `usePdvCart`, `usePdvPayments`, `usePdvCustomer`, `usePdvCheckout` em `src/hooks/pdv/*.ts`
- ✅ Cada hook < 200 linhas
- ✅ Componentes de UI extraídos: `<CartSidebar/>`, `<PaymentSection/>`, `<PdvFooter/>` em `src/components/admin/pdv/sections/*`
- ✅ `pdv-shell.tsx` final < 1500 linhas (de 3409)
- ✅ Teste smoke: ring multi-payment 3 formas + troco LIFO + finalizar venda passa
- ✅ Não introduz regressão (todos testes existentes continuam verdes)
- ❌ NÃO feito por: "ficou mais limpo visualmente"

### S4.2 — KPI estoque honra preço da variante (0.3d)

**File**: `src/actions/stock/load.ts:256-273`.

**DoD**:
- ✅ Query usa `coalesce(variant.price_in_cents, product.base_price_in_cents) * variant.stock_quantity`
- ✅ Teste unit: produto R$ 980 com variante R$ 280 stock 5 → KPI conta R$ 1.400, não R$ 4.900
- ❌ NÃO feito por: "coalesce adicionado"

### S4.3 — `window.prompt` no estorno → AlertDialog (0.3d)

**File**: `src/components/admin/receivable-payment-dialog.tsx:192`.

**DoD**:
- ✅ AlertDialog do shadcn com `<Input>` controlado pra capturar motivo
- ✅ Validação inline (motivo obrigatório, min 5 chars)
- ✅ Teste manual mobile: estorno funciona em iPhone Safari (sem `window.prompt`)
- ❌ NÃO feito por: "componente trocado"

### S4.4 — Export CSV server-side em Vendas + DRE (1d)

**Mudança**: actions server-side que geram CSV completo (não trunca).

**DoD**:
- ✅ `actions/order/export-csv.ts` server action que retorna `ReadableStream` com TODAS as vendas do filtro
- ✅ `actions/reports/export-dre-csv.ts` exporta com identifier estável (não label com símbolos "(+)")
- ✅ Botão no UI faz POST e download via blob
- ✅ Teste: filtro mês com 5000+ vendas baixa CSV completo (não 5000 truncado)
- ✅ CSV inclui cabeçalho com razão social + CNPJ + período
- ❌ NÃO feito por: "botão baixa CSV"

### S4.5 — Slug `storefront-collection` consolidado (0.1d)

**File**: `src/actions/storefront-collection/index.ts:35`.

**DoD**:
- ✅ `toSlug` local removido, import de `@/lib/slug.generateSlug`
- ✅ Teste: nome "Cafés do Sul" gera slug "cafes-do-sul" igual storefront
- ❌ NÃO feito por: "import trocado"

### S4.6 — `submitContactMessage` → `withTenant` (0.3d)

**File**: `src/actions/lead/submit-contact.ts:109`.

**DoD**:
- ✅ `withServiceRole` removido, substituído por `withTenant(store.id, null, ...)`
- ✅ Policy `lead_anon_insert` agora exercitada
- ✅ Integration test confirma INSERT funciona via policy (não bypass)
- ❌ NÃO feito por: "código trocado"

### S4.7 — `sw.js` com stamp automático (0.3d)

**Mudança**: `scripts/stamp-sw.mjs` + `prebuild` no `package.json`.

**DoD**:
- ✅ Script substitui `CACHE_VERSION = "mangospay-XXXXXXXX"` por `mangospay-${BUILD_TIMESTAMP}` no `prebuild`
- ✅ Build do Vercel não precisa de bump manual
- ✅ Teste local: `npm run build` muda o token automaticamente
- ❌ NÃO feito por: "script criado"

### S4.8 — Cleanup vocabulário + 3 cards stub (0.5d)

**Mudança**: remover ou implementar cards do index `/admin/relatorios` + renomear "Leads" → "Recados".

**DoD**:
- ✅ Card "Top clientes" implementado (loader `loadFullReport.customers.topCustomers` já existe — só extrair pra rota dedicada)
- ✅ Cards "Vendas por canal" e "Compras por fornecedor" REMOVIDOS do index (régua "funciona ou esconde")
- ✅ Dashboard `report-view.tsx` renomeia "Leads" pra "Recados do site"
- ✅ CSV do dashboard usa identifier "contact_messages" não "leads"
- ❌ NÃO feito por: "card escondido"

### S4.9 — Cleanup dead code + shortCode collision (0.3d)

**Mudança**: sweep final.

**DoD**:
- ✅ Imports não usados removidos (eslint --fix)
- ✅ shortCode collision via `e.constraint === "order_short_code_unique"` (não `e.message.includes(...)`)
- ✅ Cart localStorage com Zod `safeParse` por-item
- ✅ Logger ganha allow-list de chaves (constante `ALLOWED_PAYLOAD_KEYS` + check no `lib/logger.ts`)
- ✅ Teste: chave fora da allow-list emite warn (não derruba)
- ❌ NÃO feito por: "limpou um pouco"

### S4.10 — Checkpoint Sprint 4 (0.5d)

- [ ] DoD de cada item batido
- [ ] `tsc --noEmit` zero erro
- [ ] `npm test` verde
- [ ] `RUN_INTEGRATION=1 npm run test:integration` 40/40 verde
- [ ] Bundle size do PDV reduzido (medido via `next build`)
- [ ] Atualizar este documento marcando S4 ✅

**Total Sprint 4**: 5.6 dias úteis.

---

## 8. Total e Resumo

| Sprint | Tema | Dias úteis | Total acumulado |
|--------|------|-----------|-----------------|
| 0 | Fundamento | 1 | 1 |
| 1 | Endurecimento Produção | 4.5 | 5.5 |
| 2 | Honestidade do Dashboard | 5.6 | 11.1 |
| 3 | Lojista BR Real | 6.3 | 17.4 |
| 4 | Refinamentos | 5.6 | **23 dias úteis** |

**≈ 4-5 semanas de trabalho real.** Não é otimismo — é planejado com margem pra ajustes.

---

## 9. Backlog explícito (NÃO entra nas 4 sprints)

Itens que DELIBERADAMENTE não entram. Documentados aqui pra evitar tentação de "puxar pra Sprint atual".

### Bloco 5 — Fase 2 (Multi-tenant routing) — Sprint 5+

- Middleware Next pra `{slug}.vitre.site` OU CNAME do lojista
- Decisão DNS + Vercel wildcard cert
- Migração `vitre.site/{slug}` → `{slug}.vitre.site` (redirect 301)

### Lógica varejista avançada — Sprint 6+

- Renegociação de fiado (`receivable.parent_receivable_id`)
- Loja-rede (1 user, 2+ lojas)
- Conversão de unidade (kg na compra → ml na venda)
- Comissão flexível por categoria/produto/vendedora (não só `defaultCommissionBps` da loja)
- Multi-moeda (loja de fronteira PY/UY com peso/dólar)

### Storefront / SEO — Sprint 7+

- PWA do storefront (cliente final "adicionar à tela inicial")
- B2B real (preço atacado visível pra cliente logado mesmo no storefront público)
- Schema.org Breadcrumb + Review (hoje só Product)

### Decisões de produto pendentes (NÃO técnicas)

- Devolução cross-mês: vincular à data da venda original (atual) ou da devolução? Decisão de contador.
- `/admin/compras` é CRUD ou Relatório? Mover de grupo OU criar agregado.
- Plano Free vs Pago (Fase 3): qual é o teto do Free? Stripe pra mensalidade SaaS (NÃO checkout do lojista — esse decidido NÃO em ADR-0033).

---

## 10. Métricas de saúde por Sprint

Cada Sprint termina **só** se todas batem:

```
✅ DoD escrito por item antes do início
✅ DoD batido por item ao fim
✅ tsc --noEmit zero erro
✅ npm test 100% verde (não-skipped)
✅ RUN_INTEGRATION=1 npm run test:integration 40/40 verde
✅ Dead code sweep aplicado (eslint --fix + manual review)
✅ CLAUDE.md sincronizado com Sprint atual
✅ Este documento atualizado marcando ✅
```

Se uma falhar, Sprint NÃO está fechada. Não passa pra próxima.

---

## 11. Como gerenciar descobertas durante execução

Inevitável: ao tocar expense table, vai descobrir que cash_session precisa categoria. Ao tocar margem, vai descobrir que receivable não tem categoria. **Regra anti-bola-de-neve:**

1. Descoberta nova durante Sprint corrente → registrar em `### Descobertas durante execução` no fim deste documento
2. Se descoberta bloqueia o item atual → resolver MINIMAMENTE pra entregar DoD, deixar versão completa pro Backlog
3. Se descoberta NÃO bloqueia → ignorar até checkpoint
4. Checkpoint de Sprint: re-priorizar descobertas registradas pra Backlog (Sprint 5+, não puxar pra anterior)

### Descobertas durante execução

> (será preenchido durante as sprints, não preencher agora)

---

## 12. Histórico de execução

> Append ao final, formato `YYYY-MM-DD HH:MM — Sprint X.Y completa | bloqueada | replanejada`. Não editar entradas antigas.

- `2026-05-26` — Documento criado após auditoria sênior cruzada + conselho 5 agentes. Sprint 0 inicia agora.

---

## Anexo A — Mapa de arquivos críticos (referência rápida)

### Performance hotpath
- `src/db/index.ts:50` — pool config
- `src/lib/storefront/home-loader.ts:274` — unstable_cache + ISR
- `src/lib/storefront/_shared.ts:38-41` — attachPrimaryImage N+1
- `src/components/admin/pdv/pdv-shell.tsx` — 3409 linhas, refactor S4

### Domínio financeiro
- `src/actions/reports/load-dre.ts` — DRE atual mente
- `src/actions/reports/load-margin.ts` — margem ignora desconto
- `src/db/schema/finance.ts` — vai ganhar `expenseTable`
- `src/db/schema/inventory.ts` — `productTable` vai ganhar `weight_grams`, `productVariantTable` vai ganhar `cost_price_in_cents`
- `src/actions/purchase/index.ts:428-439` — WAC advisory lock

### Auth/produção
- `src/lib/auth.ts:65` — requireEmailVerification
- `src/app/api/auth/[...all]/route.ts` — Better Auth catch-all (rate limit S1)
- `src/lib/tenant.ts` — withTenant / withServiceRole
- `src/lib/env.ts` — env validation

### Sentinelas
- `tests/rate-limit-coverage.test.ts` — pega action sem rate limit
- `tests/stabilization-sentinels.test.ts`
- `tests/integration/rls-cross-tenant.test.ts` — 18 PRIVATE_TABLES + 5 WRITE_TABLES

### Build / deploy
- `next.config.ts:128-141` — Sentry sourcemap condicional
- `public/sw.js:29` — CACHE_VERSION (auto-stamp S4.7)
- `.github/workflows/ci.yml` — vai ganhar integration job (S0.2)
- `vercel.json` — cron jobs + region gru1
