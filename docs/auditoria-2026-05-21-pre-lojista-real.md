# Auditoria sênior — Mangos Pay, pré-lojista real (2026-05-21)

> **Status**: documento vivo. Vai sendo marcado conforme as ondas avançam.
> Auditoria conduzida em 5 eixos paralelos: bug crítico de estoque, UX do cadastro de produto, jornadas operacionais diárias, saúde técnica/escala, inconsistências cross-cutting. Segurança ficou pra leva final (próximo passo após Onda 1).
> Origem: founder relatou bug de estoque zerado após cadastro + sensação de produto disperso, pediu auditoria exaustiva pensando como gerente de loja, não como dev.

---

## Veredito em 30 segundos

O **motor** do sistema é bom — banco com transações reais, advisory locks no PDV, append-only no estoque, RLS funcionando, 491 testes verdes. Isso não é trivial; muita startup de SaaS de varejo brasileira não tem essa fundação. O problema **não é o motor — é o painel, a porta e as luzes**: o que o lojista vê na tela vaza dados que o banco gravou direitinho.

**Não pode entrar com lojista real do jeito que está hoje.** Faltam 3-5 dias de "costura de produto". Os 4 bugs mais urgentes têm causa raiz identificada. O sistema aguenta 15 lojas em escala — com 6 ajustes simples em 1-2 dias. O cadastro de produto é o que mais precisa ser repensado: tecnicamente está bem-feito, mas mentalmente está disperso.

---

## 1. O que está protegendo o negócio (não estragar)

- **Atomicidade real no PDV**: venda só fecha se TUDO der certo (lock de estoque + insert do pedido + insert de items + movimento de estoque + receivable se fiado). Sem registro órfão.
- **Estoque event-sourced**: cada movimento é um lançamento; saldo é cálculo. Auditável por histórico.
- **Snapshot de valores históricos** no pedido: preço, custo, nome do cliente, comissão — congelados no momento da venda.
- **Cupom server-side authoritative**: cliente não forja desconto.
- **RLS cross-tenant testado**: 39 cenários automatizados validam que loja A não vê dados de loja B.

---

## 2. Os 4 bugs perigosos que causam prejuízo financeiro

### 2.1 Estoque zerado depois do cadastro (CRÍTICO)

**Causa raiz exata**: `src/actions/product/create-from-values.ts:87` força `stockQuantity: 0` no INSERT — descarta o que o lojista digitou. Depois insere o movimento (`+10`) em `stock_movement`. Trigger do banco deveria recalcular o cache e atualizar `product.stockQuantity` pra 10.

**Falha intermitente**: o trigger NÃO está marcado como `SECURITY DEFINER`. Roda com privilégios do usuário atual (`vitre_app` agora sem BYPASSRLS). Pode falhar silenciosamente em algumas condições de RLS — UPDATE atinge 0 rows e Postgres não levanta erro.

**Quando falha**:
- KPI cards no topo de `/admin/estoque` leem o **cache** → mostram zero
- Feed da mesma tela lê os **movimentos** → mostra "+10"
- Lojista vê duas verdades diferentes na mesma tela.

**Replicação em `update.ts`**: `src/actions/product/update.ts:170` repete o mesmo padrão — escreve `stockQuantity` no UPDATE antes de inserir movement. Janela transient de inconsistência.

**Modo Rápido**: `quick-product-form.tsx:100-101` hardcoda `trackStock: false, stockQuantity: null`. Todo produto físico cadastrado no rápido nasce sem controle de estoque, sem aviso.

**Padrão correto já existe** em `record-physical-inventory.ts` e `record-movement.ts` — só inserem movement, deixam o trigger fazer o cache. As actions de produto NÃO seguem.

**Solução**:
1. Actions de produto NUNCA escrevem `stockQuantity` direto — só inserem movement com `movementType='initial'` (create) ou `movementType='adjustment'` com delta correto (update).
2. Tornar o trigger `SECURITY DEFINER` (com `SET search_path` explícito) pra eliminar a possibilidade de RLS bloquear o UPDATE do cache silenciosamente.
3. `CHECK (stock_quantity IS NULL OR stock_quantity >= 0)` no cache.

**Severidade**: crítica. Divergência vira prejuízo (vende o que não tem ou deixa de vender o que tem). Lojista perde confiança no número e começa a contar no caderno paralelo.

### 2.2 Quebra de caixa fantasma quando recebe fiado (CRÍTICO)

**Mecânica**: `src/actions/receivable/record-payment.ts:215-228` sempre insere `cash_adjustment.type='other_in'` no caixa aberto — independente do método (cash, PIX, cartão).

**Bug aritmético**: o fechamento Z (`src/actions/cash-session/close.ts:184-188`) e o resumo ao vivo (`cash-session/load.ts:213-217`) só somam 2 dos 6 tipos de adjustment — `sangria` e `reinforcement`. Ignoram `other_in`, `other_out`, `pay_supplier`, `pay_bill`.

**Cenários reais**:
- Cliente paga R$200 fiado em DINHEIRO → R$200 entram fisicamente na gaveta. Sistema espera só as vendas do dia. Lojista conta R$200 a mais → "diferença sem motivo" → obriga a digitar nota. Vira rotina suspeitar do próprio sistema.
- Cliente paga R$200 fiado em PIX → nada entra na gaveta. Lançamento ficou marcado como entrada de caixa → relatório de "quanto entrou em dinheiro hoje" mente.

**UI atual omissa**: `/admin/pdv/caixa/[id]/page.tsx:16-19` mapeia label só pra sangria e reforço. Os outros 4 tipos viram `undefined` na lista.

**Solução**:
1. Em `record-payment.ts`: só gerar adjustment quando `method === 'cash'`. Outros métodos ficam só no `receivable_payment`.
2. Em `close.ts` e `load.ts`: somar os 6 tipos no `closing_expected`, com sinal correto (`other_in`/`reinforcement` somam, `sangria`/`other_out`/`pay_supplier`/`pay_bill` subtraem).
3. Expandir `ADJ_LABEL` em `caixa/[id]/page.tsx` pros 6 tipos.

**Severidade**: crítica. Hemorragia silenciosa de credibilidade em 15 lojas.

### 2.3 Recibo perde dado em pagamento misto (ALTA)

**Mecânica**: venda de R$80 cash + R$50 PIX grava 2 linhas em `order_payment` corretamente. Mas:
- `src/app/(admin)/admin/pdv/recibo/[token]/page.tsx:103-105,248-263` lê só `order.paymentMethod` (legacy = primeira linha).
- `src/app/(admin)/admin/pedidos/[id]/imprimir/page.tsx` idem — não consulta `order_payment`.
- Modal de detalhe (`loadOrderDetail`) não traz `payments` no tipo retornado.
- Coluna "Pagamento" da listagem (`orders-table.tsx:104-106`) mostra só "Dinheiro" pra venda mista — **mente**.

**Solução**: todos os 4 pontos lêem `order_payment` real e renderizam multi-linha. Coluna na listagem mostra "Misto" quando há > 1 linha.

**Severidade**: alta. Cliente que reclamar do PIX que pagou não tem prova no papel.

### 2.4 Vendas do dia não somam, filtro de data não existe (ALTA)

- Botão "Hoje" em `orders-toolbar.tsx:91` é toast `"em breve"`.
- Botão "Filtros" idem.
- Toolbar mostra "X-Y de Z" — só contagem, sem soma, sem ticket médio, sem split por método.

`/admin/relatorios/vendas` existe mas é tela de análise; operação diária acontece na lista de vendas. Lojista pequeno fecha o dia OLHANDO A LISTA.

**Solução**: filtro de data funcionando (default "Hoje"), totalizador no rodapé da toolbar com soma + ticket médio + split (cash/PIX/cartão/fiado).

**Severidade**: alta. Atrito 50× por dia.

---

## 3. Cadastro de produto não pensa como lojista

Form não é tecnicamente mal-feito — tem grid 12-col, princípio 9 cumprido, helpers em alguns campos, MarginLivePreview. Mas **mostra os 30+ campos abertos por default em 5 abas**, sem hierarquia entre essencial e raríssimo.

### Jornada da Sandra fictícia

1. Toggle "Rápido | Completo" sem contexto → 60% clica Completo por hábito → abandona no meio.
2. Aba Identidade — campo "Marca" sem helper → "marca minha é a loja?" → deixa em branco.
3. Categoria vazia → tem que criar antes → 90s já gastos.
4. Aba Preço — "Atacado" sem helper → sente que faltou.
5. Card "Tributação" com NCM isolado num sub-card próprio → lojista congela. (`tab-preco-custo.tsx:198-218`)
6. Aba Estoque — "GTIN" vocabulário técnico. Lojista diz "código de barras". (`tab-estoque.tsx:204`)
7. Sub-card "Atual" com frase "Editável acima · histórico em /admin/estoque" — confusa, sem link clicável. (`tab-estoque.tsx:188-193`)
8. Aba Variantes vazia, sem instrução → 20% da navegação pra 5% dos produtos.
9. Aba Loja online com Composição/Modelagem/Forro/Lavagem pra lojista de joia → 4 campos inúteis. (`tab-loja-online.tsx:256-310`)

**Tempo total no Completo**: 6-8 minutos com sensação de incompletude.

### O que Bling/Tiny/Shopee fazem que o nosso não faz

1. **Progressive disclosure**: 95% atrás de "Mostrar mais"; 5-7 campos visíveis por default.
2. **Defaults inteligentes por tipo de loja**: joia esconde composição/forro; mostra metal/peso. Serviço não controla estoque por default. Já temos `businessType` no onboarding — não usamos.
3. **Visual primeiro**: foto em destaque no topo, mobile-first. Hoje foto fica em sub-card #2.
4. **Autosave de rascunho**: hoje é tudo ou nada.
5. **Buscar GTIN auto-preenche**: pedir código de barras primeiro quando vem do leitor.

### Reorganização proposta (conceito)

**5 abas → 3 abas**:
```
[Identidade]            [Preço & Estoque]            [Avançado]
o que é?                quanto custa, quanto tem?    raramente toco
```

- **Variantes** deixa de ser aba → botão dobrável "+ Adicionar tamanho/cor" dentro da Identidade.
- **NCM, código interno, comissão, override de parcelas, isPublishedToStorefront** → "Avançado" com frase "Esses campos são opcionais. Só preencha se sua operação precisar."
- **Composição/Modelagem/Forro/Lavagem** → só aparece se tipo de loja = "roupa".
- **GTIN → "Código de barras"** (helper menor "EAN-8, 12, 13 ou 14").
- **NCM → "Código fiscal (NCM)"** com helper "Só preencha se sua contabilidade ou Bling pediu. Não influencia em nada na venda."
- **Card "Atual"** do estoque → link clicável "Ver movimentações" com saldo grande do lado.
- **Modo default volta a ser Rápido** (não memorizado de sessão anterior). Botão "Adicionar mais detalhes" no fim leva ao Completo sem perder estado.

---

## 4. Operação do dia — funciona vs dá nó

### Funciona

- Abrir/fechar caixa com defesa contra dupla abertura
- PDV multi-pagamento (até 5 linhas) com troco calculado
- Venda fiada (100% ou parcial) gera receivable corretamente
- Inventário físico com advisory lock por entidade
- Bloqueia venda quando estoque zera

### Não funciona ou é hostil

| Tarefa | Atrito hoje | O que deveria ser |
|---|---|---|
| Esquecer de abrir caixa | Cartão cinza informativo. Venda passa silenciosa. | Banner amarelo + check explícito no início do turno |
| Entrada de fornecedor (30 SKUs) | CTA "Nova movimentação" leva pra `/admin/produtos` — produto por produto, 30× | Fluxo de Compras (`/admin/compras` existe) gerando `manual_in` em batch ao confirmar |
| Movimentação manual de saída | `notes` opcional — pode lançar -5 peças sem motivo | Motivo obrigatório (perda/doação/brinde/ajuste/troca) |
| Receber fiado em PIX | Insere `cash_adjustment` igual cash (bug 2.2) | Só gera adjustment quando `method === 'cash'` |
| Imprimir orçamento A4 | Header só com nome + data (`pedidos/[id]/imprimir/page.tsx:118-124`); kicker hardcoded "PEDIDO" | Cabeçalho universal com logo + CNPJ + endereço + telefone (`<ReportLayout/>` já existe em Gestão) |
| Imprimir recibo térmica | Largura fixa 420px — não detecta 80mm vs A4 | Detecção dinâmica + breakpoint 58/80mm |
| Vendas com fiado parcial | Sem badge "Fiado R$200" na linha | Badge visível + filtro "com saldo a receber" |
| Quebra de caixa explícita | `closingNotes` texto livre | Categoria de quebra ("erro de troco"/"cobrança a maior"/"não sei") + valor |
| Allow oversell por produto | Sempre bloqueia | Switch por produto: "permitir vender mesmo zerado?" pra venda sob encomenda |

---

## 5. Inconsistências cosméticas que viram "cara de amador"

### Vestígios do vocabulário antigo em UI (15+ ocorrências)

| Arquivo:linha | Problema |
|---|---|
| `recent-orders-table.tsx:35,48,57` | "Pedidos recentes" + "Nenhum pedido ainda" + cabeçalho "Pedido" no dashboard (1ª tela após login) |
| `receivables-list.tsx:138,213` | Coluna "Pedido" + link que vai pra listagem filtrada em vez do detalhe |
| `stock-movements-table.tsx:154` | "Pedido abc123..." em cada movimento vindo de venda |
| `order-status-actions.tsx:158,175` | Botão "Cancelar pedido" mas confirmação diz "Cancelar venda" — discordância intra-componente |
| `command-palette.tsx:54,56,76,214` | Quick action "Pedidos", placeholder "Buscar produto, cliente, pedido" |
| `configuracoes/page.tsx:37,113` | H1 "Configurações" (deveria ser "Dados da loja") + "Excluir loja remove TUDO: produtos, pedidos" |
| `suporte/page.tsx:69,73,83,94` | 4 termos antigos (atributos, storefront, "pedidos pelo WhatsApp", "leads") |
| `clientes/[id]/edit-customer-form.tsx:97,100,142` | 3× "Pedidos" no histórico do cliente |
| `whatsapp-template-card.tsx:123,127` | "Mensagem do pedido" + "quando um cliente finaliza o pedido" |
| `assinatura/page.tsx:59,72` | "Storefront público" + "Cupons, Atributos, Grupos" |
| `equipe/page.tsx:158-160` | Cheatsheet "PDV, pedidos, estoque / Clientes, leads, atributos / Cupons, banners" |
| `pdv-shell.tsx:2470` | Modal Venda Rápida diz "salvo apenas neste pedido" — dentro do PDV |
| `print-layout.tsx:55` | Kicker hardcoded `pedido: "PEDIDO"` em todo papel impresso |
| `theme-selector.tsx:212` | "não afeta seus produtos, categorias ou pedidos" |
| `bulk-actions-toolbar.tsx:139` | "Pedidos antigos com esses produtos" |
| `report-view.tsx:287` | Header CSV "Cliente, Pedidos, Gasto" |

### Glossário de estoque inconsistente

- `stock-input.tsx:62` — label "Quantidade disponível"; CLAUDE.md prescreve **"Estoque atual"**.
- `tab-estoque.tsx:32-43` — lista de unidades inclui "pc/cm/m³" e omite "par" e "dúzia" (CLAUDE.md trava em `un, kg, g, m, m², L, ml, par, dúzia`).
- `tab-estoque.tsx:189-192` — sub-card "Atual" com frase auto-referencial confusa, sem link clicável.

### Empty states inconsistentes

- **Padrão rico** (card pontilhado + ícone + CTA): produtos, clientes, pedidos, estoque feed, contagem física.
- **Padrão pobre** (texto cru): marcas, fornecedores, recados, vitrines, atributos, fiados.

### Helpbar com 3 personalidades

- Categorias: `toast.info("Vídeo de ajuda em breve.")` (frustra)
- Clientes: `<a>` sem `href`
- Produtos: texto cru "Em breve teremos vídeos"

### Padrões de form inconsistentes

- **Asterisco de obrigatório** existe só em 3 forms (customer, checkout storefront, close-cash). Resto (product-form, store-config, business-hours, coupons, attributes, brands, suppliers) descobre faltando só no submit.
- **H1 em 2 tamanhos sem regra** — listas usam 24px, telas internas 22px.
- **Botões com 38px** (`globals.css:1417`) — abaixo dos 44px que CLAUDE.md menciona como conforto mínimo.
- **`b3-btn:focus-visible`** não existe em `globals.css` — sem outline visível ao foco de teclado.

### Navegação que trava

- Link da tabela "Pedidos recentes" no dashboard (`recent-orders-table.tsx:70,99`) aponta pra `/admin/pedidos` (lista) em vez de abrir o detalhe da venda específica.
- Link da venda em `receivables-list.tsx:213` usa `?q=${orderId.slice(0,8)}` — passa ID truncado por query, filtra a lista mas não abre o detalhe.
- Breadcrumb existe em UMA tela só (`/admin/estoque/contagem`) com marcação manual. Sem componente reutilizável.

---

## 6. Vai aguentar 15 lojas?

**Premissa**: 15 lojas × ~50 vendas/dia × ~200 SKUs × ~5 operadores = ~22.500 pedidos/mês agregados.

**Custo de infra estimado**: R$ 270-600/mês total
- Vercel Pro $20 + overage compute ~$10-20
- Supabase Pro $25 + storage ~$2
- Upstash Redis ~$5-10
- Resend gratuito até 3k emails
- Sentry gratuito até 5k erros
- Total realista: $55-80 USD/mês

Se R$89/mês × 15 lojas = R$1.335 → **margem bruta de infra 55-80%**. Aperta forte só lá pelas 80 lojas (Supabase Pro Plus $599, Resend Pro $90, Sentry Team $80).

### Top 10 riscos de escala

| # | Severidade | Risco | Arquivo:linha |
|---|---|---|---|
| 1 | Alta | 7 queries sequenciais em `loadFullReport` → 300-600ms quando deveria ser 100ms | `src/actions/reports/load.ts:76-234` |
| 2 | Alta | 3 páginas sem `LIMIT` (loja 5000 SKUs = 12s carregando) | `produtos/custos/page.tsx:39-57`, `estoque/relatorio/page.tsx:41-64`, `reports/load.ts:219-234` |
| 3 | Alta | Pool de conn `max: 3` adequado pra Free; subir pra 8-10 quando migrar pra Supabase Pro | `src/db/index.ts:42-57` |
| 4 | Alta | HMAC dos crons em `vercel.json` é placeholder → cron de expire-orders quebra | `vercel.json:5,9` |
| 5 | Média | `vercel.json` sem `regions: ["gru1"]` → default IAD, +140ms RTT, PDV checkout 1.5-2s | `vercel.json` |
| 6 | Média | 3 queries serializadas em `/admin/pedidos/page.tsx` | `pedidos/page.tsx:97-151` |
| 7 | Média | N+1 escondido em busca por nome no estoque (sem trgm em `product_variant.name`) | `stock/load.ts:62-97` |
| 8 | Média | `pdv-shell.tsx` 2745 linhas (cresceu 600 em 2 semanas) — toda regra nova empilhada | `pdv-shell.tsx` |
| 9 | Média | `create-balcao-sale.ts` 1228 linhas, 3 branches duplicados 80% iguais | `create-balcao-sale.ts:473-1183` |
| 10 | Baixa | `loadStockKpis` 4 queries sequenciais | `stock/load.ts:161-237` |

---

## 7. Plano de remediação priorizado

### Onda 1 — Bloqueadores do go-live (3-4 dias)

- [x] **1.1** Corrigir bug do estoque inicial — `update.ts` deixou de regravar cache antigo (race-safe contra venda concorrente); trigger virou `SECURITY DEFINER` + `SET search_path` + `RAISE EXCEPTION` em row_count=0 (SQL 60); CHECK ≥ 0 já existia. Sentinela atualizada pra cobrir initial/adjustment em runtime. **Pendente: aplicar SQL 60 no DB Supabase + smoke manual cadastrando produto com estoque 10 e conferindo /admin/estoque.** *(`create-from-values.ts:87`, `update.ts:149-217,282-345`, `supabase/sql/60_*`, `tests/stabilization-sentinels.test.ts:32-55`)*
- [x] **1.2** Corrigir cálculo do fechamento Z — `record-payment.ts` só gera `cash_adjustment` quando `method === 'cash'` (PIX/cartão não inflam mais a gaveta); `close.ts` e `load.ts/computeSummary` agora somam os 6 tipos em UMA query agregada (entradas: reinforcement+other_in; saídas: sangria+pay_supplier+pay_bill+other_out); `CashSessionSummary` recebeu 4 campos novos; UI de `/admin/pdv/caixa/[id]` exibe linhas só quando > 0 e pílulas IN/OUT consistentes. tsc=0, 498/498 unit, 39/39 integration. *(`receivable/record-payment.ts:200-233`, `cash-session/close.ts:140-188`, `cash-session/load.ts:163-227`, `cash-session/types.ts:6-22`, `pdv/caixa/[id]/page.tsx:16-28,107-150,168-200`)*
- [x] **1.3** Recibo + impressão + listagem + modal de detalhe lendo `order_payment` real, não `paymentMethod` legacy. `loadOrderDetail` ganhou `payments[]`; recibo térmico lista cada linha com troco somado das linhas em cash; A4 ganhou seção "Pagamento(s)"; listagem ganhou `paymentCount` (batch via GROUP BY, sem N+1) e mostra "Misto" quando > 1; modal exibe lista completa com troco linha-a-linha; fallback legacy mantido pra pedidos pre-backfill ADR-0034. tsc=0, 498/498 unit, 39/39 integration. *(`actions/order/load-detail.ts:38-87,133-150,170-180`, `pdv/recibo/[token]/page.tsx:11-22,71-94,103-141,257-310`, `pedidos/[id]/imprimir/page.tsx:18-26,52-76,114-138,317-360`, `pedidos/page.tsx:1-18,100-176,212`, `orders-table.tsx:23-58,108-110`, `order-detail-dialog.tsx:28-37,269-313`)*
- [x] **1.4** Filtro de data funcional em `/admin/pedidos` — `dateOrNullSchema` no `page-search-params`, query string `?de=YYYY-MM-DD&ate=YYYY-MM-DD`. Toolbar tem 4 atalhos toggle (Hoje/Ontem/7 dias/Mês) + popover "Filtros" com inputs date pra range custom + chip removível pra range custom ativo. Rodapé direito mostra agregados do **período filtrado** (count + total + ticket médio) e pílulas com split por método via JOIN `order_payment`. Vendas canceladas/expiradas saem do total/ticket. Coluna "Misto" da 1.3 mantida. tsc=0, 498/498 unit, 39/39 integration. *(`page-search-params.ts:138-156`, `pedidos/page.tsx:1-32,46-77,88-105,160-225,242,300-308`, `orders-toolbar.tsx` rewrite completo)*
- [x] **1.5** `vercel.json` agora tem `regions: ["gru1"]` (latência Brasil) e crons com HMAC real gerados via `scripts/sign-cron-urls.ts` contra `CRON_SECRET` do `.env.local`. **Pendência: confirmar que `CRON_SECRET` em Vercel ▸ Settings ▸ Environment Variables é igual ao local — senão a sig calculada no prod não bate e cron volta a 401.** *(`vercel.json`)*
- [x] **1.6** `.limit()` defensivo: `/admin/produtos/custos` limita 1500 + COUNT separado + banner "mostrando X de Y"; `/admin/estoque/relatorio` idem com 2000; `loadFullReport stockRows` agora roda 2 queries específicas (zeroStock / lowStock) com filtro server-side + limit 200 por bucket em vez de puxar todos e filtrar em JS. tsc=0, 498/498 unit, 39/39 integration. *(`produtos/custos/page.tsx:39-71,104-122`, `estoque/relatorio/page.tsx:41-83,103-110`, `reports/load.ts:218-263`)*
- [x] **1.7** Find/replace controlado em 14 arquivos: dashboard ("Vendas recentes" + header "Venda" + empty "Nenhuma venda ainda"); receivables-list (coluna "Venda"); stock-movements ("Venda abc…"); order-status-actions (botão "Cancelar venda" — bate com confirmação); command-palette (label/hint/placeholder + `kindLabel`); configuracoes (H1 "Dados da loja" + danger zone "vendas"); suporte (4 cards: filtros da loja / loja online / vendas pelo WhatsApp / recados); edit-customer-form (3× histórico de vendas); whatsapp-template (Mensagem da venda); assinatura (Loja online + Códigos de desconto, Filtros); equipe (cheatsheet "vendas/recados/filtros/códigos"); pdv-shell Venda Rápida ("nesta venda"); theme-selector ("vendas" + "loja online"); bulk-actions (Vendas antigas); report-view (CSV "Vendas"); print-layout kicker "VENDA" (mantém type identifier "pedido" por ser chave técnica). Storefront público de checkout preserva "Pedido" — vocabulário do cliente final, não do lojista. tsc=0, 498/498. *(14 arquivos)*
- [x] **1.8** Empty state rico (card pontilhado + ícone circular + título + descrição + CTA) em 6 telas: marcas (Bookmark), fornecedores (Truck), recados (MessageSquareText — só quando não há filtros; com filtros mostra mensagem de "nenhum encontrado"), vitrines (LayoutGrid), filtros da loja (Filter), fiados (CheckCircle verde, "Nenhum fiado pendente"). 498/498 unit, 39/39 integration. *(6 arquivos)*

### Onda 2 — Cadastro de produto repensado + operação fluida ✅ FECHADA

- [x] **2.1** Form de produto reorganizado: 5 abas → 3 (Identidade / Preço & Estoque / Avançado). Variantes virou dobrável `<details>` dentro de Identidade. TabKey + TAB_FIELDS atualizados em `shared.tsx`. *(`product-form.tsx`, `product-form/shared.tsx:233-272`)*
- [x] **2.2** Progressive disclosure no form: `TabPrecoCusto` recebeu `hideAdvanced`/`onlyAdvanced` — essencial (preço/custo/margem) na aba "Preço & Estoque", avançado (promo/atacado/comissão/NCM) na aba "Avançado". "Mais detalhes de estoque" (código de barras/código interno/unidade) dobrável dentro do tab-estoque. Aba Avançado tem orientação "campos opcionais". *(`tab-preco-custo.tsx` rewrite, `tab-estoque.tsx`)*
- [x] **2.3** Campos por tipo de loja: `storeNiche` passado da page → ProductForm → TabLojaOnline. Composição/Modelagem/Forro/Lavagem só aparecem quando `niche === "roupa_feminina"`. Lojista de joia/perfume não vê mais 4 campos de moda. *(`product-form.tsx`, `tab-loja-online.tsx`, `produtos/novo/page.tsx`, `produtos/[id]/page.tsx`)*
- [x] **2.4** Compras como entrada batch: `createPurchase` JÁ gerava `manual_in` por linha (`src/actions/purchase/index.ts:497-505`). Só faltava o CTA — `/admin/estoque` "Nova movimentação" agora aponta pra `/admin/compras/novo` em vez de `/admin/produtos`. *(`estoque/page.tsx:130-144`)*
- [x] **2.5** Saída manual exige motivo: refine no `recordMovementSchema` rejeita manual_out e adjustment negative sem `notes`. Dialog `stock-movement-dialog` ganhou pílulas de motivo (Perda/Doação/Brinde/Troca/Uso interno) clicáveis. Sentinela de teste atualizada. *(`stock/schema.ts:55-78`, `stock-movement-dialog.tsx:65-78,260-318`)*
- [x] **2.6** Caixa fechado virou banner amarelo proeminente (era cinza neutro) com `role="alert"` e ícone `AlertTriangle`. Texto firme: "Abra o caixa antes da primeira venda…". Sem bloquear venda (decisão ADR-0022 D1 preservada). *(`cash-session-status.tsx:37-77`)*
- [x] **2.7** Cabeçalho universal: novo componente `<PrintStoreHeader variant="a4"|"thermal" />` com logo, nome, CNPJ formatado, endereço, telefone. Aplicado em recibo térmico, A4 de venda/orçamento e Z (parcial e fechado). Coluna `store.document` adicionada via SQL 63 + schema TS. *(`print-store-header.tsx` novo, `pdv/recibo/[token]/page.tsx`, `pedidos/[id]/imprimir/page.tsx`, `pdv/caixa/[id]/page.tsx`, `store.ts`, `supabase/sql/63_*`)*
- [x] **2.8** UI padronizada: `b3-btn` foi de 38px → **44px** (mínimo confortável mobile) + `focus-visible` com outline brand. `<Label required>` aceita prop que renderiza asterisco vermelho — aplicado em Nome e Preço de venda do form de produto. H1 padronizado em 22px (era 22 vs 24 sem regra) em 8 páginas. *(`globals.css:1413-1442`, `label.tsx`, vários pages)*
- [x] **2.9** Autosave de rascunho: hook `useFormDraft<T>` salva debounced no localStorage com TTL 24h. Integrado no `ProductForm` quando `isCreating`. No mount, se houver rascunho com nome preenchido, oferece via toast com ações "Restaurar" / "Descartar". Limpa após submit ok. *(`hooks/use-form-draft.ts` novo, `product-form.tsx`)*
- [x] **2.10** Vocabulário estoque: `stock-input.tsx` label "Estoque atual" (era "Quantidade disponível"). Lista de unidades agora bate com CLAUDE.md (un/kg/g/m/m²/L/ml/par/dúzia), removidas pc/cm/m³ do select (permanecem no enum pra produtos legados). SQL 61 adiciona `par`/`duzia` ao enum `product_unit`. *(`stock-input.tsx:62`, `tab-estoque.tsx:34-44`, schema TS + Zod, `supabase/sql/61_*`)*
- [x] **2.11** Helpbars de "vídeo em breve" removidas: categorias (`toast.info` frustrante), clientes (`<a>` sem href), produtos (texto cru). Imports de `InfoIcon` removidos. Voltam quando houver vídeo real. *(`categories-admin.tsx`, `clientes/page.tsx`, `produtos/page.tsx`)*
- [x] **2.12** Navegação ao detalhe: query param `?detail=<orderId>` (com `idOrNullSchema` no Zod) abre `OrderDetailDialog` automaticamente. Dashboard "Vendas recentes" e lista de fiados agora linkam pro detalhe específico em vez de filtrar a lista. *(`pedidos/page.tsx`, `orders-table.tsx`, `recent-orders-table.tsx`, `receivables-list.tsx:213`)*
- [x] **2.13** Badge "Fiado R$X" na linha de vendas: query batch agregada que cruza `receivable` + `receivable_payment` por order_id (sem N+1) calcula saldo pendente. Pílula `b3-pill--warn` ao lado do status na listagem. *(`pedidos/page.tsx`, `orders-table.tsx:118-129`)*
- [x] **2.14** Quebra de caixa categorizada: dialog de fechamento Z ganhou pílulas clicáveis (Erro de troco / Cobrança a maior / Cobrança a menor / Sangria não lançada / Recebimento não lançado / Não sei) que pré-preenchem o campo de notas. Label vira "Motivo da diferença" quando há delta. *(`close-cash-dialog.tsx:175-210`)*
- [x] **2.15** Switch "permitir vender zerado": coluna `allowOversell boolean default false` adicionada via SQL 62, schema TS + Zod, UI no `tab-estoque` (sub-card "Encomenda / pré-venda" só visível quando trackStock=on). Lógica de respeitar no PDV fica pra Onda 3 (precisa tocar `create-balcao-sale.ts`). *(SQL 62, `catalog.ts`, `product/schema.ts`, `create-from-values.ts`, `update.ts`, `tab-estoque.tsx`, `product-form.tsx`)*

### Onda 3 — Refatores estruturais (Fase 3, antes da Monetização)

- [ ] **3.1** Quebrar `pdv-shell.tsx` em hooks (`usePdvCart`, `usePdvPayments`, `usePdvDiscount`) + componentes (`CartList`, `PaymentSection`, `CustomerPicker`). *(3 dias)*
- [ ] **3.2** Refator `create-balcao-sale.ts` — extrair `prepareOrderContext`, `executeStockReservation`, `insertOrderWithRetry`. Sale/Quote/Fiado viram orquestradores de ~50 linhas. *(2 dias)*
- [ ] **3.3** Paralelizar loaders (`/admin/pedidos`, `loadStockKpis`, `loadFullReport`). *(1 dia)*
- [ ] **3.4** Source maps reais no Sentry (`next.config.ts:139`). *(2h)*
- [ ] **3.5** `next/dynamic` em components 400+ linhas client-side (`cost-grid-client`, `product-form`, `collections-manager`, `attributes-manager`, `categories-admin`). *(4h)*
- [ ] **3.6** Criar índice trigram em `product_variant.name` (SQL 60, mesmo padrão do SQL 05). *(30min)*
- [ ] **3.7** Subir pool `max: 3 → 10` quando migrar pra Supabase Pro. *(15min)*

### Onda 4 — Segurança (leva separada, após Onda 1)

- [ ] **4.x** Auditoria focada: RLS pol. completas, rate limit cobertura, secrets handling, headers (CSP/HSTS), signup hardening, validação de inputs em borders, exposição de dados sensíveis (logs/errors), escopo e revogação de session, brute-force, CSRF, auditoria de roles.

---

## 8. Resumo de uma linha

**Fundação ótima, vitrine ruim.** Os 4 bugs de negócio (estoque, caixa fantasma, recibo misto, vendas do dia) são correções pequenas com causa raiz já identificada. O cadastro de produto precisa de uma onda de empatia com o lojista, não de mais código. Vocabulário inconsistente é o que mais faz parecer amador, e é o mais barato de consertar. Em 3-4 dias dá pra entrar com o primeiro lojista real; em 10-12 dias dá pra entrar com 15 lojas confiantes.
