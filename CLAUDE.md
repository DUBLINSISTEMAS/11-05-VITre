# Mangos Pay — Norte Operacional

> Documento vivo. Carregado automaticamente em toda sessão do Claude Code.
> Atualizar a seção "Sprint atual" a cada Sprint fechada.
> Quando passar de 400 linhas, mover histórico antigo pra `docs/sessoes/`.

---

## O que o Mangos Pay é (decisão fechada, não revisitar)

Sistema de gestão para lojas de pequeno/médio porte (joia, semijoia, roupa, perfumaria, calçados, acessórios) em cidades do interior do Brasil. Catálogo público + checkout WhatsApp + admin de gestão + PDV balcão num só produto.

**ICP**: lojista que **não emite NF interna** (NF fica em sistema do contador ou via Bling/Tiny). Mangos Pay NÃO emite NF-e/NFC-e/SPED. NCM = texto livre para futura integração externa. Ver ADR-0033.

**Diferencial defensável**: loja online integrada nativa. Concorrentes (GFIL/Bling/Tiny/Dimas) NÃO têm storefront público de fábrica. Todo trabalho no storefront fortalece moat; todo trabalho clonando GFIL diminui.

**Domínio operacional**: `vitre.site` (vitre.site/{slug-da-loja} hoje; subdomínio `{slug}.vitre.site` planejado pra Fase 2 Bloco 5).

---

## Princípios de execução (regras inquebráveis)

1. **Vocabulário do varejo BR, não SaaS-EUA.** "Venda" não "Pedido". "Vitrine" não "Coleção". "Filtro" não "Atributo". "Recado" não "Lead". Lista canônica abaixo.
2. **Operação primeiro, polimento depois.** PDV multi-pagamento > etiqueta bonita. Fiado > tema escuro. Conta a pagar > animação Lottie.
3. **Densidade utilitária estilo planilha-de-contador** nas telas de gestão. Brilho visual só em storefront público, login, onboarding e PDP.
4. **Schema-first.** Migration + RLS + CHECK constraints ANTES da UI. UI sobre schema incompleto = retrabalho garantido.
5. **Append-only quando possível.** Correção via lançamento reverso, não UPDATE. Vale pra `order_payment`, `purchase_item`, `cash_adjustment`, `stock_movement`.
6. **Snapshot de valores históricos.** Custo no momento da venda, nome do cliente na hora do pedido, preço aplicado — tudo gravado pra sobreviver a mudanças futuras.
7. **Tudo de mutação é server action `"use server"`.** Client nunca chama Drizzle. Loaders com prefixo `load*` são leituras puras, sem side-effect.
8. **Produto é nó central, não apêndice da loja online.** O cadastro de produto alimenta com peso igual: venda balcão, gestão de estoque, relatório de margem, fiado/financeiro, compras e catálogo público. A UI do form NÃO pode parecer "preenche tudo pra loja online aparecer" — tem que parecer "registro central que alimenta o sistema inteiro". `isPublishedToStorefront` é UM checkbox entre dezenas, não a moldura mental do form.
9. **Inteligência espacial — sem formulários esticados borda a borda.** Campo numérico curto (preço, custo, %, quantidade, GTIN, código interno) NUNCA ocupa 100% da largura sozinho — vai em grid de 2 ou 3 colunas. Campo texto longo (descrição, observação, composição) ocupa linha cheia. Campos relacionados ficam visualmente agrupados em sub-cards ou fieldsets com 16-20px de respiro. Se a tela tem 4+ contextos distintos (identidade vs custo vs estoque vs catálogo), divide em abas — nunca scroll vertical infinito. Densidade utilitária ≠ apertado: respiração proposital entre grupos é parte da legibilidade.
10. **Funciona ou esconde.** Feature exposta na UI tem que entregar fluxo ponta-a-ponta no caminho comum, senão remove da UI (rota pode seguir viva por URL). Aplicado em 2026-05-24 (sprint flash): Equipe, Atributos, Assinatura e Estoque-baixo escondidos por essa régua.

---

## Disciplinas anti-bagunça (meta-regras)

1. **Nenhum ADR novo enquanto Sprint atual estiver aberta.** Decisão pequena = commit + comentário. ADR só pra mudança estrutural irreversível.
2. **Nenhuma feature nova entra sem responder: "qual fluxo essa feature completa?"** Se for "vai ficar disponível pra quando alguém precisar", NÃO constrói. Atributo, Coleção, Cupom, Lead já foram construídos assim — não repetir.
3. **Toda Sprint termina com auditoria curta.** `tsc --noEmit` zero erro + `npm test` 100% verde + dead code sweep + sync CLAUDE.md. Sem isso, drift acumula.
4. **Sem prompt amplo pro Claude Code.** Prompt é cirúrgico: analisa → mostra diff → espera aprovação humana → aplica. Não "refatore toda a sidebar"; sim "leia X, liste Y, proponha Z, espere meu OK". Exceções (auditoria explícita pedida pelo founder com `/agents`) viram tasks rastreadas.

---

## Arquitetura da navegação (canônica)

Sidebar do admin tem **4 grupos**, cada um com 4-6 itens. Lojista que abre o admin entende em 30 segundos sem texto explicativo. Não inventar quinto grupo.

### Grupo 1 — Operação (o que faço HOJE)

| Item | Rota |
|---|---|
| Venda balcão (PDV) | `/admin/pdv` (também via modal "Nova venda" do topbar / F2) |
| Caixa do dia | `/admin/pdv/caixa` |
| Vendas | `/admin/pedidos` |
| Movimentação de estoque | `/admin/estoque` |
| A receber (fiado) | `/admin/financeiro/receber` |
| Recados do site | `/admin/contatos` |

### Grupo 2 — Cadastros (monto UMA VEZ, mexo pouco)

| Item | Rota |
|---|---|
| Produtos | `/admin/produtos` |
| Categorias | `/admin/categorias` |
| Marcas | `/admin/marcas` |
| Clientes | `/admin/clientes` |
| Grupos de cliente | `/admin/clientes/grupos` |
| Fornecedores | `/admin/fornecedores` |

### Grupo 3 — Gestão (OLHO pra decidir)

| Item | Rota |
|---|---|
| Vendas por período | `/admin/relatorios/vendas` |
| Margem por produto | `/admin/relatorios/margem` |
| Top produtos | `/admin/relatorios/top` |
| Estoque (relatório) | `/admin/estoque/relatorio` |
| DRE simplificado | `/admin/relatorios/dre` |
| Compras | `/admin/compras` |
| Custo & margem (batch) | `/admin/produtos/custos` |

### Grupo 4 — Loja online + Configurações (AJUSTO esporadicamente)

| Item | Rota |
|---|---|
| Aparência | `/admin/aparencia` |
| Banners | `/admin/banners` |
| Vitrines (coleções) | `/admin/colecoes` |
| Códigos de desconto (cupons) | `/admin/promocoes/cupons` |
| Formas de pagamento | `/admin/pagamento` |
| Dados da loja | `/admin/configuracoes` |

Item "Suporte" no footer da sidebar / menu do avatar.

**Escondidos do menu (régua "funciona ou esconde")**: `/admin/atributos`, `/admin/equipe`, `/admin/assinatura`. Rotas vivas só por URL.

---

## Vocabulário canônico (find/replace controlado)

Aplicar APENAS em labels visíveis ao usuário (UI strings, breadcrumbs, toasts, títulos, empty states). NÃO renomear arquivos, rotas, identifiers TypeScript, nem nomes de coluna no DB.

| Antigo | Novo |
|---|---|
| Pedido / Pedidos | Venda / Vendas |
| PDV / Balcão | Venda balcão |
| Promoções (item do menu) | Descontos |
| Cupom / Cupons | Código de desconto |
| Atributo / Atributos | Filtro da loja |
| Coleção / Coleções | Vitrine / Vitrines |
| Contato / Lead | Recado do site |
| Pagamento (menu raiz) | Formas de pagamento |
| Aparência (raiz isolada) | Loja online → Aparência |
| Configurações | Dados da loja |
| Storefront | Loja online |
| Tenant / Store | Loja |
| Stock movement | Movimentação de estoque |
| Marca (campo texto livre) | Marca (selecionada do cadastro) |

Régua: se ficou um vestígio do termo antigo em UI, é bug.

---

## Glossário operacional — estoque (travar copy nas labels)

**Controlar estoque** (switch on/off)
- *ON*: produto físico que precisa contar. Sistema desconta automático a cada venda, soma a cada compra. Default `true` desde SQL 69.
- *OFF*: serviço, produto sob encomenda, consignado. Sistema deixa vender sem checar quantidade.
- Helper: *"Deixe ligado se você conta as peças. Desligue para serviços ou produtos sob encomenda."*

**Estoque atual** (número, calculado)
- Não é editável por digitação direta. É somatório de movimentações: compras (+), vendas (−), devoluções (+), ajustes manuais (±), perdas (−).
- Pra corrigir, lojista usa "Lançar ajuste manual" com motivo obrigatório.

**Estoque mínimo / máximo** (números, opcionais)
- Mínimo = quando atual cai abaixo, produto aparece em "Estoque baixo" do dashboard + notificação no sino.
- Máximo = útil para relatório "estoque parado".

**Unidade** (select: un, kg, g, m, m², L, ml, par, dúzia) — default 'un'.

---

## Impressão e exportação — padrão universal (Sprint 4 ✅)

Sistema implementado em 2026-05-26. **Toda tela do Grupo 1 (vendas, listagens) e Grupo 3 (gestão) tem botão "Imprimir" universal** que dispara `window.print()` direto, sem nova aba.

**Componentes:**
- `<PrintPageButton />` — botão universal pra imprimir página atual. CSS global `@media print` esconde `[data-admin-chrome]` (sidebar + topbar). Plugado em `/admin/pedidos`, `/admin/clientes`.
- `<ReportLayout />` — A4 imprimível pra relatórios (`/admin/relatorios/*` e `/admin/estoque/relatorio`). Header com logo + dados da loja + CNPJ. Footer com "Gerado em DD/MM/AAAA HH:MM por {operador}".
- `<SaleReceiptThermal />` — cupom 80mm pra venda balcão (`/admin/pedidos/[id]/imprimir?formato=termica`). Toggle visível Térmica ↔ A4.
- **Exportar CSV** em listagens (vendas + relatórios) baixa o filtro atual (pendência: vendas hoje exporta só página, fix em backlog).

CSS bug histórico corrigido em 2026-05-26: `body:has(.report-print-root)` agora gate a regra restritiva, evitando que páginas sem ReportLayout imprimam em branco.

---

## Sprint atual: Plano de Endurecimento Sprints 0-4 ✅ FECHADAS (2026-05-26)

**Sessão maratona de ~10h em 2026-05-26 fechou 4 sprints inteiras** (com 1 item de S4.1 parcial). Estado real:

- **Sprint 0** Fundamento: 2/3 ✅ + 1 ⏸️ externa (Sentry token no Vercel)
- **Sprint 1** Endurecimento Produção: 5/6 ✅ + 1 deferido (Resend externo)
- **Sprint 2** Honestidade do Dashboard: **7/7 ✅**
- **Sprint 3** Lojista BR Real: **6/6 ✅**
- **Sprint 4** Refinamentos: **8/8 ✅** (S4.1 pdv-shell refactor 3409→3295 + estrutura modular; refactor pleno defer pra S5 com E2E test antes)

**Estado verificado**: 80 SQLs em prod, 590 testes (548 pass / 0 fail / 42 skipped), tsc + lint zero erro. Branch única `main`. ~30 commits nesta sessão.

**Descoberta crítica durante S2.6**: `order_item.unit_cost_snapshot_in_cents` era NULL pra TODAS vendas — invalidava margem do sistema. Fix incluído (snapshot agora `coalesce(variant.cost, product.cost)` em PDV e WhatsApp checkout).

**Dívidas residuais documentadas**:
- S0.2 CI Integration RLS — 15 tabelas skipam por GRANT não-debugado (test file tem TODO).
- S4.1 pdv-shell refactor pleno — 9 componentes ainda no shell, precisa E2E test antes.
- UIs pendentes: lote na compra (S3.4), pausa-venda PDV (S3.3), ajuste taxa cartão (S2.4).
- recordReceivablePayment com distribuição juros→multa→principal (helper pronto, falta plugar).

**Pendências externas do founder** (4 itens curtos):
1. Vercel: `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (10 min)
2. GitHub: secret `PROD_DIRECT_URL` (3 min)
3. Supabase: rotacionar senha exposta (5 min)
4. Resend: domínio próprio + flip email verification (~30 min, defer)

**Sistema pronto pra Sandra/Vânia operar diariamente**: DRE não mente, fiado cobra multa/juros, margem por variante, aging report, vendedoras com comissão, sangria 6-tipo, quota/rate-limit, DR doc, CSV server-side, storefront pixel-perfect.

Detalhes completos em memória `sessao-2026-05-26-sprints-0-a-4.md` + `docs/PLANO-ENDURECIMENTO.md` (com status atualizado por item).

---

## Sprint anterior: Estabilização Semana 1 D1-D5 (2026-05-26)

**Objetivo (PLANO-ENDURECIMENTO.md)**: transformar Mangos Pay de "MVP solo bem feito" em "SaaS pronto pra 10-15 lojas operando todo dia, sem mentir nos números, sem cair no pico, sem deixar dinheiro do lojista na mesa".

Auditoria sênior cruzada (3 agentes paralelos + conselho 5 agentes) revelou 10 bloqueadores reais + 13 dores diárias. Plano de 4 sprints com Definition of Done escrito por item.

### Sprints fechadas neste dia

**Sprint 0 — Fundamento** (1/3 done + 1 quase + 1 externa):
- S0.1 ✅ Pool DB max 5/1 (`5c20683`)
- S0.2 🟡 CI integration RLS (workflow + script ok, último fix `9ae00cb` Node 22)
- S0.3 ⏸️ Sentry sourcemap (depende founder setar `SENTRY_AUTH_TOKEN` no Vercel)

**Sprint 1 — Endurecimento Produção** (5/6 done, 1 deferido):
- S1.1 ⏸️ Email verification (defer — Resend domínio externo)
- S1.2 ✅ Rate limit Better Auth catch-all (`61bf2af`)
- S1.3 ✅ Quota por loja + SQL 73 (`3be1955`)
- S1.4 ✅ Sanitize 5 actions financeiras + `@/lib/safe-error` (`b1adbbe`)
- S1.5 ✅ attachPrimaryImage DISTINCT ON (`e33e2b3`)
- S1.6 ✅ DR doc + backup script + weekly cron (`d9bd78b`)

**Sprint 2 — Honestidade do Dashboard** (7/7 ✅ FECHADA):
- S2.1 ✅ Schema expense + RLS + 4 actions CRUD + integration test (`5fca31a`, SQL 75)
- S2.2 ✅ Tela /admin/financeiro/pagar com KPIs/filtros/dialog (`fe656c8`)
- S2.3 ✅ DRE com despesas operacionais reais (`b1b5361`)
- S2.4 ✅ Taxa real cartão deduzida + SQL 76 (`2661c65`)
- S2.5 ✅ Margem subtrai desconto manual (`2b4d048`)
- S2.6 ✅ Variante cost_price_in_cents + WAC variante-aware + cost snapshot no order_item (`7178f7b`, SQL 77)
- S2.7 ✅ weight_grams no produto + SQL 74 (`2b4d048`)

### Descoberta crítica durante S2.6

`order_item.unit_cost_snapshot_in_cents` NÃO estava sendo gravado em nenhuma venda (PDV nem WhatsApp). Bug invalidava toda margem do sistema (relatórios filtram `WHERE not null`, retornavam vazio). Fix incluído no commit `7178f7b`: snapshot agora vem de `coalesce(variant.cost, product.cost)` em ambos os sites.

### Estado técnico verificado

73 SQLs aplicadas + 77 = **78 SQLs em prod** (até #77 + 99_cleanup), 580 testes (539 pass / 0 fail / 41 skipped integration), `tsc --noEmit` zero erro, lint zero erro (2 warnings non-blocking), branch única `main`.

### Próximo bloco

**Sprint 3 — Lojista BR Real** (~5-6 dias): sold_by_user_id ativo + comissão calculada, multa+juros fiado, pausa-venda PDV, lote/validade pra perfumaria, aging report, sangria 6-tipo. Detalhamento em `docs/PLANO-ENDURECIMENTO.md` §6.

**Sprint 4 — Refinamentos** (~5-6 dias): refactor pdv-shell.tsx 3409→<1500 linhas, KPI estoque variant price, window.prompt → AlertDialog estorno, CSV server-side vendas+DRE, slug consolidado, submitContact via withTenant, sw.js auto-stamp, cleanup dead code.

### Pendências externas (4 itens curtos, não-código)

1. Setar `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` no Vercel — fecha S0.3 (10 min, doc em `docs/sentry-setup.md`)
2. Setar `PROD_DIRECT_URL` como GitHub secret — destrava workflow `backup-weekly.yml` (3 min)
3. Rotacionar senha Supabase — exposta em conversa de 2026-05-26 (5 min)
4. Resend domínio próprio + flip `requireEmailVerification: true` — destrava S1.1 quando lojista entrar (~30 min)

## Sprint anterior: Cadastros Sprint 1 ✅ FECHADA (2026-05-26)

**Objetivo**: destravar feature de wholesale (que estava 100% pronta no backend mas zumbi por 2 pontos de UI faltando) + cleanup óbvio + ordenação na tabela de produtos.

### Entregue na Cadastros Sprint 1

- **C1 Cliente form com Select de Grupo** — `customer/schema.ts` + `customer-form.tsx` ganham `groupId`. Drawer carrega grupos via `loadCustomerGroups()`. Esconde Select se loja não tem grupo.
- **C2 Customer Group form com `defaultPricingTier`** — 2 botões "Preço normal" / "Preço de atacado" no dialog do customer-groups-manager. Schema upsert agora propaga campo. PDV já consumia via `groupPricingTier` — agora a ponta de cadastro fecha o ciclo.
- **C4 Cleanup** — `update-related.ts` órfão (~120 linhas server action sem caller) DELETADO.
- **C5 Cleanup** — `slugifyBrand` + `slugifyClient` agora delegam pro canônico `generateSlug` em `lib/slug.ts` (pacote slugify locale pt). Antes eram 2 cópias NFD+replace manual que podiam divergir do storefront.
- **C6 Supplier máscara CPF/CNPJ** — `maskDocumentInput` plugado no manager (consistente com customer-form). Schema já validava dígito-verificador (`isValidCpf`/`isValidCnpj`).
- **C7 Ordenação de produtos** — `?sort=updated-desc|name-asc|name-desc|price-asc|price-desc|stock-asc|stock-desc` URL-driven. Select de 7 opções no `products-toolbar`. Lojista com 250 SKUs agora consegue "menor estoque primeiro".

### Deferido

- **C3 CEP autocomplete (cliente + fornecedor)** — ViaCEP integration + hook + plug em 2 forms. Backlog Sprint 2 alta prioridade.

## Sprint anterior: Estoque Sprint 2 ✅ FECHADA (2026-05-26)

**Objetivo**: tirar Estoque das frições 🟠 que custavam cliques diários (sem ser blocker mas atrapalhando). Atingido — 4 de 5 itens.

### Entregue na Sprint 2

- **E9 Coluna "Valor em R$"** na snapshot table — lojista escolhe quem repor por capital empatado, não unidade. Tooltip mostra valor de custo.
- **E10 Filtros de data no feed** — presets Hoje/Ontem/7d/Mês + chip custom (mesmo padrão de orders-toolbar). Auditoria forense agora viável sem rolar página por página.
- **E11 Toggle "saldo final" no ajuste manual** — dialog oferece 2 modos: "Lançar diferença" (delta, padrão) ou "Tenho o saldo contado" (sistema calcula delta + direção sozinho). Resolve a confusão "atual era 12, contei 8, digito -4 ou 8?".
- **E13 KPI "Ajustes do mês"** mostra agora delta absoluto também — "12 lançamentos · 47 peças movimentadas".
- **E12 Aging report deferido** — produtos sem venda há N dias é Sprint 3 (precisa LATERAL JOIN + nova tab, decidi não estourar tempo).

## Sprint anterior: Estoque Sprint 1 ✅ FECHADA (2026-05-26 — bloqueadores 🔴)

**Objetivo**: tirar Estoque do "NÃO está pronto pra Vânia usar" — 3 bloqueadores 🔴 identificados pela auditoria sênior (KPI saldo em unidades · tab Alertas paginação quebrada · botão "+" disabled em produto com variantes). Atingido.

**Estado**: 72 SQLs em prod, 537 testes verdes (+ 40 skipped integration), tsc zero erro.

### Entregue

- **E1 KPI Saldo em R$ (custo + venda + unidades)** — antes era "487 un" (soma de anel+brinco+colar inútil). Agora "R$ 84.500 a custo · R$ 156.200 a venda · 487 un como contexto". Lojista responde "quanto vale o estoque?" sem abrir relatório.
- **E2 Tab Alertas server-side OR** — novo `status: "alerts"` em `loadStockSnapshot` (zero ∪ low). Antes carregava 2 queries paginadas + merge local com `total = items.length` mentindo. Agora paginação honesta com total real.
- **E3 Botão "+" da snapshot ativa pra produto com variantes** — antes disabled; o `StockMovementDialog` já suportava multi-variante via Select, só faltava passar `variantBreakdown`. Joalheria com 60% de variantes economiza 30-45 cliques por compra recebida.
- **E4 KPI "Compras no mês"** — filtra agora SÓ `manual_in`. Devoluções e ajustes positivos não inflavam o número. Renomeado pra clareza.
- **E5 KPI exclui produtos draft** — antes KPI somava produtos com slug `draft-%`, tabela snapshot não — divergência (497 ≠ 487). Agora ambos consistentes.
- **E6 Cleanup trivial** — checkbox "Selecionar todos" placeholder removido, JSX comment órfão, `export type NewStockMovement` (sem importer), emoji 🌱 do empty state.

### Backlog de Estoque deferred (não-bloqueante)

🟠 Frição alta (Sprint 2 — quando atual estiver fechada):
- Coluna "Valor em R$" na snapshot table (qty × custo) — joalheira escolhe quem repor por valor, não unidade
- Filtro de data + por produto no feed de movimentações
- Toggle "saldo final" no ajuste manual (hoje só delta, label confunde)
- Aging report — produtos sem movimentação há N dias
- KPI "Ajustes do mês" mostrar delta absoluto, não só count

🏗️ Estrutural (precisa schema migration):
- Manual_in com `unitCostInCents` + motivo obrigatório (atualiza CMP)
- Contagem física com segmentação por categoria + truncate warning
- Importação CSV real (hoje stub fake) — gate de onboarding sério
- Lote/validade pra perfumaria/cosmético do ICP

---

## Sprint anterior: Vendas SaaS-grade ✅ FECHADA (2026-05-26)

**Objetivo**: deixar Vendas usável diariamente por lojista BR de pequeno varejo, sem dor de cabeça em fluxo comum (abrir caixa → ring sales → fiado → cancelar/devolver → fechar caixa → imprimir cupom). **Atingido.**

**Estado verificado em 2026-05-26**: 72 SQLs em prod, 537/577 testes verdes (+ 40 skipped que rodam só com `RUN_INTEGRATION=1`), `tsc --noEmit` zero erro.

### O que foi entregue (turnos 1-7 do dia 2026-05-26)

**Turno 1 — Sprint flash 1** (3 fixes): prefetch do PdvShell · banner "Caixa fechado" no PDV · badge "Fiado em aberto" no card do cliente vinculado.

**Turno 2 — Análise sênior + Sprint 1.2** (4 fixes): cliente obrigatório no submit · stock check preemptivo por item · atalhos F-keys visíveis no rodapé do PDV (FKeysLegend) · ícone "obs" na linha de pedido.

**Turno 3 — Sprint 2** (3 fixes): status inline-edit (dropdown no badge da linha) · print sem nova aba (target=_blank removido) · botão print direto na linha da tabela.

**Turno 4 — Sprint 4 sistema universal de impressão** (3 entregas): `<SaleReceiptThermal />` cupom 80mm + toggle Térmica/A4 · bug CSS global de print corrigido (page em branco quando sem ReportLayout) · `<PrintPageButton />` reusável plugado em listagens.

**Turno 5 — Sprint 3 cartão com juros** (SQL 72): coluna `card_interest_free_up_to` no `store` · form em `/admin/pagamento` com select "X parcelas sem juros" + input "% ao mês" · `loadPdvConfig` · `lib/installments.ts` aplica Sistema PRICE em cents · PDV mostra "12× de R$ 50 (com juros) · Total c/ juros: R$ X".

**Turno 6 — Refinamentos finais** (3 entregas): sino do topbar com dot real via `loadAdminNotifications` (vendas WhatsApp pendentes 24h + estoque crítico, polling 60s visibility-aware) · coluna "Itens" na orders-table (sum quantity) · botão "Aplicar à venda" no PDV pra juros virarem acréscimo automático.

**Turno 7 — Cleanup + finalização** (3 ondas):
- **Onda 1 polimento**: FKeysLegend duplicado removido · checkbox "Selecionar todos" placeholder removido · drawer mostra "Crédito 3×" (não só "Crédito").
- **Onda 2 dead code**: deletados `product-actions-menu.tsx`, `related-products-card.tsx`, pasta `/admin/produtos/[id]/etiqueta/`, `barcode-label.tsx`, 6 scripts one-off, dep `jsbarcode`. 4 cópias locais de `formatBRL` consolidadas em `lib/pricing.ts` (canônico agora com thousand separator + NBSP normalizado).
- **Onda 3 refinamentos reais**: 3× `window.confirm` migrados pra AlertDialog (limpar carrinho, lançar fiado, cancelar inline) · edição inline de observação da venda no drawer (action `updateOrderNotes`) · audit de desconto manual > 10% via `recordAuditEvent` (anti-fraude vendedora).

### Régua "pronto pra usar daily"

Lojista BR de joalheria/perfumaria/roupa em cidade do interior consegue:
1. Abrir caixa → ver banner se esquecer ✅
2. Ring multi-payment (até 5 formas) com troco automático LIFO ✅
3. Vender com cartão crédito + juros calculado via Sistema PRICE ✅
4. Lançar fiado parcial ou total com vencimento ✅
5. Ver badge "Fiado em aberto" do cliente ANTES de liberar mais crédito ✅
6. Mudar status da venda clicando no badge (inline-edit) ✅
7. Imprimir cupom térmico OU A4 sem nova aba ✅
8. Editar obs da venda depois ✅
9. Receber notificação de venda WhatsApp nova em ≤60s ✅
10. Atalhos F2/F3/F4/F9/ESC visíveis no rodapé do PDV ✅
11. Auditoria de descontos grandes registrada em `audit_event` ✅
12. Cancelar venda inline com confirmação rica (AlertDialog) ✅

### Backlog de Vendas deferred (não-bloqueante)

- **#2 Inline product search no PDV** — refator de `pdv-shell.tsx` (3300+ linhas hoje) pra eliminar segundo dialog. Esforço L. Não bloqueia uso.
- **#3 full Vendedor no order** — `sold_by_user_id` + UI + filtro + relatório por operadora. Esforço L. Bloqueia comissionamento em loja com 2+ vendedoras.
- **#8 Devolução iniciada pelo PDV** — hoje vai pelo drawer; lojista com cliente devolvendo no balcão precisa sair do PDV. Esforço M.
- **CSV de vendas server-side** — exporta só página atual hoje. Esforço M.
- **PIN do dono pra desconto > X%** — config setting + dialog + audit table dedicada. Esforço M.
- **Adjustment dialog com 6 tipos** — hoje só sangria + reforço; schema suporta 6 (pay_supplier, pay_bill, other_in, other_out). Esforço S.

---

## Próximas Sprints (ordem real)

**Em curso (Semana 1 D4-D5)**: Auditoria sênior **Relatórios** (`/admin/relatorios/*`). Último módulo grande não auditado. Mesmo método de Vendas/Estoque/Cadastros.

**Módulos ainda não auditados** (Semana 3, "boutique"): Clientes (drawer detalhado, agregações), Configurações.

**Fase 2 Multi-tenant Pleno** — Semana 2, GATE DE PRODUÇÃO:
- Bloco 1 ✅ Isolamento real (role `vitre_app`, FORCE RLS em 32+ tabelas)
- Bloco 2 ✅ Validação automatizada (`tests/integration/rls-cross-tenant.test.ts`)
- **Bloco 3** ✅ Signup self-service — fluxo `/criar-loja/{conta,identidade,tipo-negocio,bem-vindo}` 4 passos. signUpStoreOwner (Better Auth + rate limit) → createStore (RLS-aware + slug check + categorias seed em UMA transação). Admin layout guard: sem sessão → /entrar; sem store → /criar-loja/identidade. Idempotência: user com store existente → /admin. Persistência entre passos via sessionStorage. Validado em 2026-05-27 (Onda 32).
- **Bloco 4** 🟡 Hardening de auth — INFRA pronta (Onda 32 — 2026-05-27): página `/verificar-email` com reenvio cooldown 60s, action `resendVerification` rate-limited, SQL 0034 grandfathering de users existentes, signUpStoreOwner com redirect condicional. Rate limit catch-all em `/api/auth/*` (Sprint 1.2) + senha mínima 8 chars + `revokeSessionsOnPasswordReset: true`. ATIVAÇÃO aguarda: (1) Resend domain DKIM/SPF/DMARC + (2) rodar migration 0034 em prod + (3) flip `EMAIL_VERIFICATION_REQUIRED=true` no env Vercel.
- **Bloco 5** ❌ Roteamento multi-tenant — middleware Next pra `{slug}.vitre.site` ou CNAME do lojista.

Esforço total Fase 2 restante: ~5-7 dias. **Gate absoluto pra qualquer lojista real entrar em produção.**

**Fase 3 — Monetização**: plano Free com limite + plano Pago via Stripe (mensalidade Mangos Pay, NÃO checkout do lojista). Começa quando Fase 2 fechar.

**Fase 5 — Onboarding do primeiro lojista real**: criar conta da Sandra (ou outro) via signup self-service, importar produtos via planilha, smoke test prod, Lighthouse mobile ≥ 90. NÃO antes da Fase 2 fechar.

---

## Convenções técnicas obrigatórias (não revisitar sem dor concreta)

1. **RLS-first** — toda tabela de domínio carrega `store_id`; toda query passa por `withTenant(storeId, userId, fn)`. Ver `src/lib/tenant.ts`. Exceções intencionais: tabelas do better-auth (`user`, `session`, `account`, `verification`) não têm RLS — o provider gerencia próprio isolamento via session token.
2. **Zod em todos os boundaries** — server actions, env vars, route handlers. Schema em `actions/*/schema.ts`, importado por client e server.
3. **Mutações server-only** — client nunca chama Drizzle. Sempre `"use server"`. Ações com prefixo `load*` são leituras async pra dialogs client, sem side-effects.
4. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
5. **Imagens** — sharp 800×800 WebP 75% ANTES do upload. Max 5 imagens/produto. Servidas via `next/image`.
6. **Rate limit** — endpoints sensíveis (auth, orders, upload, PDV) protegidos via `@upstash/ratelimit`. Toda mutation `"use server"` chama `checkRateLimit(rateLimits.mutation, userId)`; reads (`load*`, `search*`) ficam sem rate limit (autenticadas + escopadas via RLS). Sentinela `tests/rate-limit-coverage.test.ts` falha se nova action mutadora esquecer.
7. **Slugs reservados** — ver lista em `src/lib/slug.ts`.
8. **Naming PT-vs-EN** — URLs e UI strings em PT-BR (vocabulário do lojista: `/admin/aparencia`, `"Filtros da loja"`). Pastas, identifiers TypeScript e nomes de função em EN (convenção dev: `attributeTable`, `loadOrderDetail`). Nunca misturar dentro da mesma camada.
9. **Sem `sql.raw` com input dinâmico** — todo input no SQL deve ser parametrizado (Drizzle template tag `sql\`\`` faz automaticamente). Calcule server-side antes (ex: `new Date(Date.now() - days * 86400000)` em vez de `sql.raw(\`interval '${days} days'\`)`).
10. **Integration tests RLS pré-merge** — qualquer mudança em: schema de tabela com `store_id`, policy RLS, role/grant, `withTenant` / `withServiceRole`, ou nas suites `tests/integration/*` exige rodar localmente `RUN_INTEGRATION=1 npm run test:integration` e confirmar **40/40 verde** antes de commit/merge. CI hoje só faz unit (`npm test`); gate de integration roda contra DB real e ainda não tem DB ephemeral na pipeline (defer Fase 5). Esse é o cinto que pegou o vazamento de `lead_anon_insert` (SQL 58); pular ele = vazamento volta sem aviso.
11. **Auditoria forense via `recordAuditEvent`** — operações sensíveis (open/close caixa, devolução, reverso de pagamento, desconto manual > 10%) gravam linha em `audit_event` na MESMA transação. Falha de audit NÃO derruba a operação (princípio: audit é defensivo, não bloqueante). Ver `src/lib/audit.ts`.

## Stack (não revisitar sem problema concreto)

Next 15 + React 19 + TypeScript · Drizzle ORM + Supabase Postgres · Better Auth (somente lojista) · Supabase Storage · shadcn/ui + Tailwind v4 · TanStack Query · react-hook-form + Zod 4 · Sonner · Resend · Upstash Ratelimit · sharp · Sentry · Vercel.

**Não usamos**: Stripe (lojista cobra fora do Mangos Pay), Supabase Auth, Prisma, NextAuth, Electron.

## O que NÃO fazer

- ❌ Adicionar Stripe ao checkout do storefront (lojista cobra fora do Mangos Pay)
- ❌ Cadastro/login de cliente final no storefront. Carrinho em localStorage. Favoritos em localStorage. Reafirmado [ADR-0008](docs/decisoes/0008-ux-catalogo-publico-storefront.md)
- ❌ NF-e, SEFAZ, integração fiscal. [ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md)
- ❌ Acesso remoto/captura de tela dentro do produto. Suporte = AnyDesk fora do produto. [ADR-0018](docs/decisoes/0018-suporte-remoto-fora-do-produto.md)
- ❌ Pular RLS "pra facilitar"
- ❌ Subir imagens sem compressão
- ❌ Fazer mutação sem `revalidateTag`
- ❌ Pular ADR antes do código quando a mudança é estrutural — MAS não criar ADR pra decisão pequena (regra meta-1)
- ❌ Construir feature sem fluxo de uso claro (régua "funciona ou esconde")
- ❌ Formulário em coluna única com campos numéricos curtos ocupando 100% (princípio 9)
- ❌ Tratar produto como apêndice da loja online (princípio 8)
- ❌ `window.confirm` ou `window.alert` em fluxos de venda — usar AlertDialog do shadcn (consistência visual + mobile)
- ❌ Implementar formatBRL local — sempre importar de `@/lib/pricing`

## Ambiente

Windows 11 + PowerShell + VS Code + **Claude Code** (CLI). PT-BR. Repo em `C:\Users\ANDERSON FELIPE\Documents\MANGOS PAY\`.

## Founder

Anderson Felipe — dev solo, PT-BR. Aplica `/arrow-skill` (conselho-5-agentes) em decisões substanciais. Quer abordagem de dev sênior, sem amadorismo. Estilo de colaboração: **copiloto + piloto** — age, não pergunta a cada passo. Confirma antes de operações destrutivas.

---

## Quando uma decisão merece ADR

Apenas se TODOS forem verdadeiros:
- Muda schema de tabela existente OU cria tabela nova
- Tem consequência arquitetural irreversível em ≤30 dias de trabalho
- Outro dev abrindo o projeto pela primeira vez precisa entender o porquê

Senão: commit com mensagem clara + comentário em código. Lista de "decisões que parecem ADR mas não são":
- Escolher cor, espaçamento, tipografia → commit
- Adicionar campo nullable em tabela existente → commit
- Decidir entre dois pacotes npm que fazem a mesma coisa → commit + comentário
- Mudar texto de UI → commit
- Migrar `window.confirm` pra AlertDialog → commit

---

## Histórico (congelado — não editar)

Estado de fases até 2026-05-21 vive em:
- `docs/decisoes/` (ADRs 0001-0034, ordem cronológica)
- `docs/sessoes/` (logs de sessões importantes)
- `docs/auditoria-2026-05-21/` (5 docs read-only do estado pré-Sprint 2)
- `docs/produto/roadmap.md`
- `docs/CONTEXT.md`

Marcos:
- MVP catálogo (Fases 0-1.6) ✅
- Redesign canvas-v1 ✅
- Auditoria pré-deploy 2026-05-10 (7 ondas) ✅
- Pivô para Mangos Pay Gestão 2026-05-15 ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md))
- Fases 2-5 + PWA do pivô ✅ (2026-05-16)
- Veto fiscal explícito 2026-05-19 ([ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md))
- Camada Comercial Mangos Pay 2026-05-19 ([ADR-0034](docs/decisoes/0034-camada-comercial-vitre.md))
- Sprints 0 → 6 ✅ fechadas até 2026-05-21 (`docs/sessoes/2026-05-21-fechamento-sprints-0-a-6.md`)
- Fase 1.7 (deploy técnico) encerrada 2026-05-21
- Fase 2 (Multi-tenant pleno) Bloco 1 ✅ + Bloco 2 ✅ em 2026-05-21
- Sprint flash pós-conselho-5-agentes 2026-05-24 (parcelamento cartão, status venda balcão, AlertDialog do orçamento, trackStock default true, SQLs 69-70)
- Domínio operacional mudou de `mangospay.app` pra `vitre.site` em 2026-05-25
- Redesign pixel-perfect PP1-PP15 ✅ admin completo (2026-05-25)
- Sprint Vendas SaaS-grade 2026-05-26 — 7 turnos, 25+ fixes (impressão universal, cartão com juros, notificações in-app, cleanup 12 arquivos órfãos).
- Sprint Estoque 1+2 e Cadastros Sprint 1 ✅ FECHADAS 2026-05-26.
- Catch-up `feat/redesign-admin-storefront` → `main` em 2026-05-26 — 41 commits, fast-forward, vitre.site production passa a refletir TODO o trabalho sênior das últimas semanas.
- **MARATONA SPRINTS 0-4 DO PLANO DE ENDURECIMENTO em 2026-05-26** — ~10h de sessão fecharam 4 sprints (S0 fundamento, S1 produção, S2 honestidade 7/7, S3 lojista BR 6/6, S4 refinamentos 8/8). 80 SQLs em prod (até #80), 590 testes, ~30 commits. Sistema PRONTO pra lojista BR operar diariamente — DRE não mente, fiado cobra multa, comissão por vendedora, aging/lote/validade, sangria 6-tipo, quota/rate-limit, DR doc. Próximo bloco: Fase 2 Bloco 3-4-5 (signup self-service + hardening auth + roteamento subdomain) OU resolver dívidas residuais (pdv-shell refactor pleno + S0.2 GRANT debug).
- **Storefront — Ondas 1-31 em 2026-05-26/27** — 31 ondas de polimento sênior: hierarquia conversão, PDP cirúrgico (×2), trust + share API, search typeahead, favoritos mobile, fade transitions, sistema tipográfico canônico, cantos Apple-style, sticky compact, paridade carrinho ↔ sidebar, Onda 31 resiliência (6 bugs + 3 atenções: telemetria removida, idempotency persistente, timeout 20s, cap stockQty, debounce cupom, regex nome).
- **Fase 2 Bloco 3 ✅ + Bloco 4 🟡 INFRA em 2026-05-27 (Onda 32)** — Bloco 3 já estava substancialmente pronto (auditoria revelou), só faltava sync docs. Bloco 4: página `/verificar-email`, action `resendVerification` rate-limited, SQL 0034 grandfathering, flag `EMAIL_VERIFICATION_REQUIRED` no env. Aguarda Resend domain pra flip em prod. Próximo: Bloco 5 (subdomain routing).

**Norte vivo sobrescreve qualquer ADR conflitante.** Se ADR antigo disser X e este arquivo disser Y, vale este arquivo. ADR é registro de decisão no momento; norte vivo é régua de execução atual.
