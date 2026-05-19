# ADR-0034: Camada Comercial Vitrê — o que entra no lugar do fiscal

- **Data**: 2026-05-19
- **Status**: aceito
- **Cumpre promessa de**: [ADR-0033](./0033-veto-fiscal-explicito.md) ("ADR-0034 — camada comercial — o que entra no lugar")
- **Convive com**: [ADR-0012](./0012-pivot-vitre-gestao.md) (pivô gestão — guarda-chuva), [ADR-0015](./0015-estoque-event-sourced.md), [ADR-0016](./0016-pdv-balcao.md), [ADR-0020](./0020-pdv-desconto-acrescimo-dual.md), [ADR-0022](./0022-caixa-formal-cash-session.md), [ADR-0025](./0025-grupos-clientes.md), [ADR-0026](./0026-cupons.md), [ADR-0029](./0029-equipe-multi-user.md)
- **Suspende temporariamente**: [ADR-0019](./0019-port-dublin-v3-bagy-style.md) high-fidelity 44 telas (parked até ≥5 clientes pagantes pedirem)

## Contexto

Em 2026-05-19 founder apresentou Vitrê a prospects (joalheria Ytalo + lojistas de Imperatriz que usam GFIL Delphi v11). Pasta `PAINEL REF/` contém 12 screenshots do GFIL trazidos pela sessão. Feedback unânime: **"está amador, falta muita coisa"**. ADR-0033 fechou a porta do caminho fiscal (NF-e/SEFAZ/SPED) e prometeu este ADR como contrapeso — o que de FATO entra no lugar pra fazer Vitrê ser "sistema comercial sério" sem virar Bling/Tiny.

Auditoria do schema atual confirmou que o feedback é **arquitetônico, não cosmético**:

- `product` não tem `cost_price_in_cents` → margem matematicamente impossível
- `product` não tem `min_stock_quantity` → sem alerta de reposição
- `product` não tem `gtin` (código de barras) → scanner USB inútil no PDV
- `product` não tem `brand` / `unit` / `internal_code` → relatórios e busca quebrados
- `order` não tem `seller_id` → comissão de vendedor vira planilha paralela
- `order` aceita só uma `payment_method` → realidade do balcão (R$ 80 pix + R$ 70 dinheiro) não cabe
- `order_item` não snapshota custo → margem histórica reescreve quando custo do produto muda
- Não há `supplier` / `purchase` → custo médio não rastreado
- Não há `receivable` → fiado/crediário (operação central do varejo BR SMB) some
- `cash_adjustment` cobre sangria/reforço mas não cobre pagar conta de luz, pagar fornecedor — lojista anota no caderno e o sistema mente o saldo

Sem esses dados-fonte, ser bonito (Dublin v3) não muda o veredito "amador" porque a informação que sustenta o negócio simplesmente não existe.

## Princípios desta camada

1. **Vocabulário do varejo BR**, não vocabulário SaaS-EUA. Fiado, sangria, suprimento, romaneio, pré-venda, orçamento, NCM, atacado/varejo — nominados assim.
2. **Densidade utilitária estilo planilha-de-contador** onde a feature é de gestão. Brilho visual fica restrito a storefront, login, onboarding, PDP.
3. **Vitrê NÃO calcula tributo** (ADR-0033). NCM aceita como texto livre pra futura integração com Bling/Tiny. Imposto = decisão de quem emite NF em outro sistema.
4. **Schema-first**. Camada 1 (dado-fonte) precisa estar 100% antes de qualquer UI nova. Sem isso a UI tem que ser refeita quando dado-fonte chegar.
5. **Não duplicar entidades**. Orçamento = `order.status='quote'`, não tabela `quote` nova. Pagamento dividido = tabela filha `order_payment`, não JSON na order.
6. **Custo médio móvel** ao registrar entrada de fornecedor. Sem isso, lojista que compra 100un a R$ 8 e depois 50un a R$ 12 nunca tem custo correto.
7. **Append-only quando possível**. `order_payment`, `purchase_item`, `cash_adjustment` (já), `stock_movement` (já) — correção via lançamento reverso, não UPDATE.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A — Clonar GFIL feature-por-feature | Fecha venda rápido com prospects que viram GFIL | Vitrê vira "Bling pior"; perde foco; em 12 meses 200 telas e nenhuma diferenciada |
| B — Camada comercial mínima + parked Dublin v3 (escolhida) | Destrava prospects sem perder o moat (loja online); 5-7 semanas dev solo; cada camada citável | Dublin v3 high-fidelity adia 2-3 meses; alguns prospects 100% NF-dependentes não migram (já aceito em ADR-0033) |
| C — Port Dublin v3 high-fidelity primeiro, camada comercial depois | UI bonita pra fechar venda | Schema continua sem dado-fonte → UI bonita pra feature que não responde a pergunta de margem; refazer UI quando dado-fonte chegar; 6-12 semanas sem entregar funcionalidade |

## Decisão

**Entregar 7 camadas em ordem causal**, cada uma destravando a seguinte. Cada camada citável por número (Camada 1 / 2 / ... / 7). Sem virar Bling. Sem tocar em fiscal.

### Camada 1 — Dado-fonte (schema + RLS, zero UI)

**`product` ganha**:
- `cost_price_in_cents` `integer NULL` — custo unitário em centavos. NULL = lojista ainda não preencheu (UI mostra warning, não bloqueia).
- `min_stock_quantity` `integer NULL` — alerta de reposição. NULL = sem alerta.
- `max_stock_quantity` `integer NULL` — opcional pra projeção de compra; sem alerta visual no MVP.
- `gtin` `text(14) NULL` — EAN-13 ou DUN-14 sem máscara. CHECK length IN (8, 12, 13, 14). UNIQUE parcial `(store_id, gtin) WHERE gtin IS NOT NULL`.
- `brand` `text NULL` — texto livre. Sem tabela `brand` separada no MVP (founder texta varejo BR — Adidas, Vivara, Lacoste — não precisa de hierarquia). Promover pra tabela quando aparecer caso real.
- `unit` `product_unit enum NOT NULL DEFAULT 'un'` — valores: `un`, `pc`, `kg`, `g`, `m`, `cm`, `ml`, `L`, `m2`, `m3`. Default `un` cobre 95% varejo SMB.
- `internal_code` `text NULL` — código interno do lojista (SKU manual). UNIQUE parcial `(store_id, internal_code) WHERE internal_code IS NOT NULL`.
- `default_commission_bps` `integer NULL` — comissão padrão do vendedor pra esse produto em basis points (0..10000 = 0..100%). NULL = usa `store.default_commission_bps` (a ser adicionado em Camada 5).
- `ncm` `text(8) NULL` — código NCM brasileiro pra integração futura com Bling. **Vitrê NÃO valida nem calcula imposto a partir disso** (ADR-0033).

**`order` ganha**:
- `seller_id` `text NULL` → FK `user.id` (Better Auth). NULL pra pedidos whatsapp e backfill. Validation no app-layer força NOT NULL pra `channel='balcao'` quando equipe ativa (≥1 membership).
- `external_fiscal_doc` `text NULL` — campo livre onde lojista anota número de NF emitida em outro sistema (Bling, contadora, emissor da prefeitura). ADR-0033 D2 cumprida.
- `price_table_used` `price_table enum NULL DEFAULT NULL` — valores: `retail`, `wholesale`, `promo`. NULL pra whatsapp; NOT NULL pra balcão (validation app).

**`order_item` ganha**:
- `unit_cost_snapshot_in_cents` `integer NULL` — custo unitário no momento da venda. Snapshot pra que margem histórica não reescreva. NULL pra itens antigos (backfill defere).

**Tabela nova `order_payment`** (pagamento dividido):
- `id`, `order_id` FK CASCADE, `store_id` (RLS), `method` enum (reaproveita `order_payment_method` existente — cash/pix/debit/credit/other), `amount_in_cents` integer NOT NULL, `cash_received_in_cents` integer NULL (só relevante quando method=cash), `notes` text NULL, `created_at`.
- Migração: `order.payment_method` + `order.cash_received_in_cents` viram backfill em `order_payment` (1 linha por pedido existente). Colunas no `order` ficam por 2 release cycles e então removem em ADR de cleanup futuro.
- CHECK app-layer: `SUM(order_payment.amount) == order.total - discount + surcharge`.

**Enum `cash_adjustment_type` estende** (mantém ADR-0022 D3 = tabela separada não-unificada):
- Adiciona valores: `pay_supplier`, `pay_bill`, `other_in`, `other_out`.
- `sangria` e `reinforcement` permanecem.
- App-layer mapeia sinal: `sangria`/`pay_supplier`/`pay_bill`/`other_out` = saída; `reinforcement`/`other_in` = entrada.

**Tabelas novas `supplier` + `purchase` + `purchase_item`**:
- `supplier`: id, store_id (RLS), name NOT NULL, document NULL (CPF/CNPJ formato igual customer), phone, email, address fields, notes, is_active, created_at. UNIQUE `(store_id, document) WHERE document IS NOT NULL`.
- `purchase`: id, store_id, supplier_id FK SET NULL, invoice_number text (NF do fornecedor anotada, NÃO emitida), total_in_cents, paid_at NULL, payment_method (reaproveita enum), notes, created_at, created_by_user_id.
- `purchase_item`: id, purchase_id FK CASCADE, product_id FK SET NULL, variant_id FK SET NULL, quantity NOT NULL, unit_cost_in_cents NOT NULL, total_cost_in_cents (generated stored).
- Trigger: ao inserir `purchase_item`, gera `stock_movement` type=`manual_in` com `reference_type='purchase'` e atualiza `product.cost_price_in_cents` via **custo médio móvel ponderado** = `((stock_atual * custo_atual) + (qty_nova * custo_novo)) / (stock_atual + qty_nova)`.

**Tabela nova `receivable`** (fiado/crediário):
- id, store_id (RLS), customer_id FK SET NULL (cliente pode ser anônimo de balcão? **não — fiado exige cliente cadastrado**, NOT NULL), order_id FK SET NULL (vincula à venda original — pode existir fiado sem order, ex: empréstimo em dinheiro pro cliente), amount_in_cents, due_date timestamp NULL, paid_at timestamp NULL, paid_method (reaproveita enum) NULL, notes, created_at.
- Status implícito via `paid_at` (NULL = pendente). Sem enum extra.
- Quando `paid_at` é setado, app-layer gera `cash_adjustment` type=`other_in` na sessão de caixa ativa.

**SQL**: CHECKs novos em `supabase/sql/44_*.sql`, `45_*.sql`, etc. RLS owner-only pra supplier/purchase/receivable. order_payment herda via order_id (JOIN policy).

### Camada 2 — Cadastro produto refeito (UI)

**Calibração 2026-05-19** (founder, após mensagem reforçando separação por concern): custo NÃO mistura com cadastro identidade. Separação por **quem mexe e quando** — identidade é cadastro único (delegável a estagiário), custo é dado financeiro sensível, estoque muda toda hora.

**5 abas em `/admin/produtos/[id]`**, paradigma GFIL "Dados Públicos vs Dados Privados" adaptado pra Vitrê single-tenant:

1. **Identidade** (substitui o cadastro básico atual) — nome, descrição, categoria, marca, código interno, GTIN (com botão "abrir scanner USB"), unidade (enum), fotos.
2. **Comercial** — preço de venda (basePrice), preço de atacado (futura coluna `wholesalePriceInCents` em Camada 2 OU já no schema antes — decidir; preliminar: adicionar coluna agora pra evitar segunda migration), promoção (campos `promo*` existentes).
3. **Custo & Margem** — preço de custo, % comissão padrão (default_commission_bps), **margem calculada ao vivo** ("Lucro R$ 16/un · Margem 200% · Markup 200%"), alerta "produto sem custo → margem desconhecida" quando cost IS NULL.
4. **Estoque** — qtd atual (read-only, do cache de stock_movement), mínimo, máximo, toggle `track_stock`. Aviso visual em vermelho quando `stockQuantity < minStockQuantity`.
5. **Loja Online** — composition/modeling/lining/washing (campos existentes), `isPublishedToStorefront`, vínculos a `storefront_collection`. (Tributação NCM mora aqui também como campo discreto — não há reason pra dar aba inteira pra 1 campo livre que tooltip-explica "Vitrê não calcula imposto".)

**Plus tela dedicada `/admin/produtos/custos`** (bulk edit estilo planilha):

Tabela de TODOS os produtos do tenant ordenada por "sem custo primeiro / com custo depois". Colunas inline-editable: produto (foto + nome read-only), preço de venda (read-only), **preço de custo (input editable)**, **margem (calculada read-only)**, comissão %. Salva em batch ao apertar "Salvar tudo" ou debounced ao sair do foco. **Sem isso, lojista não preenche 200 produtos um por um — feature da Camada 5 (relatório de margem) fica vazia.**

### Camada 3 — PDV refeito (UI + actions)

- Vendedor **opcional pra lojista solo, obrigatório pra equipe**. Regra de validation: campo `seller_id` ganha required SOMENTE quando existem ≥2 `store_membership` ativos na loja (owner + ≥1 staff/viewer). Lojista solo não vê o combobox no PDV; relatórios agrupam tudo como "Dono". Quando primeiro funcionário é convidado e aceita, combobox aparece automaticamente. UI desaparecer/aparecer baseado em count de equipe ativa — calculado server-side e passado como prop pro PDVShell.
- Toggle tabela de preço (Varejo / Atacado / Promo).
- Carrinho com desconto unitário por item (não só geral).
- Pagamento dividido: botão "+ adicionar forma" gera linha em `order_payment`. Soma vs total destacada com badge.
- **Impressão via `@react-pdf/renderer` em 80mm** — sai em térmica USB padrão (driver imprime PDF), funciona em laser/jato sem ajuste. Web Serial + ESC/POS direto + Tauri ficam parked até dor concreta (caso de ≥2 lojistas com impressora térmica antiga que recusa PDF).
- Orçamento via `order.status='quote'`: botão "Salvar como orçamento". Não baixa estoque, não cria `stock_movement`, não conta em relatório de venda. Pode imprimir o PDF do orçamento (mesma máquina de impressão, template diferente).
- Romaneio sem valores (PDF 80mm sem coluna preço — só descrição e quantidade). Sai junto da mercadoria pra entrega.
- F-keys mantidas (F2/F3/F4/ESC).

### Camada 4 — Caixa de verdade

- Abertura/fechamento já existem.
- Botões nominados pra avulso: **Sangria** (já), **Suprimento** (já como reinforcement), **Pagar fornecedor** (novo, gera `pay_supplier`), **Pagar conta** (novo, `pay_bill`), **Entrada avulsa** (`other_in`), **Saída avulsa** (`other_out`).
- Fechamento mostra esperado vs contado **com divergência destacada** + campo "motivo" obrigatório se divergência ≠ 0 (já implementado).
- Relatório de caixa do dia (já existe parcialmente em `/admin/pdv/caixa`) ganha breakdown por tipo.

### Camada 5 — Gestão (relatórios)

Rotas read-only, padrão URL-driven (CLAUDE.md #11):
- `/admin/relatorios/vendas` — período × forma de pagamento × vendedor × categoria × tabela de preço.
- `/admin/relatorios/margem` — margem bruta por produto / por período. Usa `unit_cost_snapshot` do `order_item`.
- `/admin/relatorios/top` — top produtos (vendidos / margem / giro).
- `/admin/estoque/baixo` — lista produtos com `stock_quantity < min_stock_quantity`, ordenados por urgência (gap absoluto). Botão "criar compra" pré-populado.
- `/admin/relatorios/dre` — DRE simplificado mensal: receita - custo direto (sum unit_cost_snapshot) - comissão (sum vendedor) - despesa avulsa (sum cash_adjustment saída exceto sangria-pro-cofre) = lucro estimado.
- **Export CSV** em todos (já existe `loadStockKpis` pattern, replicar).

**ReportLayout universal — entra desde Camada 2, generaliza pra todas as rotas de relatório.**

Componente compartilhado `<ReportLayout />` em `src/components/admin/report/report-layout.tsx`. Recebe:
- `title` (ex: "Relatório de Estoque")
- `period` opcional (ex: "01/05/2026 a 19/05/2026")
- `storeInfo` (logo + nome + endereço + CNPJ se cadastrado)
- `columns` (array de `{ key, label, align, format }`)
- `rows` (array de objetos)
- `totals` opcional (somatório destacado no rodapé)
- `notes` opcional (rodapé editorial — "Gerado em DD/MM/AAAA HH:mm")

Renderiza HTML otimizado pra A4 com `@page { size: A4; margin: 12mm }` em CSS print. Paginação automática via `page-break-inside: avoid` em rows. Botão "Imprimir" no topo da página dispara `window.print()` que abre dialog nativo. Botão "Exportar CSV" como segunda opção (alternativa pra contador que prefere planilha).

**Razão**: empresário do varejo BR lida com PAPEL. Discute resultado com contador, com sócio, com banco. Export CSV resolve dev/integração; ReportLayout resolve operação real do dia.

Rotas que consomem o mesmo componente:
- `/admin/estoque/relatorio` (Camada 2 — primeira aplicação, mesmo antes de relatórios)
- `/admin/relatorios/vendas/relatorio?de=X&ate=Y`
- `/admin/relatorios/margem/relatorio?de=X&ate=Y`
- `/admin/relatorios/dre/relatorio?mes=Y`
- `/admin/pedidos/[id]/relatorio` (alternativa A4 ao cupom térmico — ambas existem, lojista escolhe)

### Camada 6 — Compras + Inventário

- `/admin/compras` — listagem URL-driven + drawer pra nova compra (fornecedor combobox + items repeater).
- `/admin/fornecedores` — CRUD URL-driven (mesmo pattern de `/admin/clientes`).
- `/admin/estoque/inventario` — tela única "contagem física" — lista todos produtos com estoque > 0, lojista preenche "contado", sistema gera `stock_movement` type=`adjustment` em lote ao salvar.

### Camada 7 — Fiado/crediário

- `/admin/financeiro/receber` — listagem URL-driven (pendente / pago / vencido). Filtro por cliente. Botão "marcar pago" abre modal com forma de pagamento e gera `cash_adjustment` type=`other_in` na sessão ativa.
- PDV ganha botão "Lançar como fiado" quando cliente está selecionado (sem cliente, botão desabilitado com tooltip).
- Dashboard admin ganha widget "Total a receber" + "Vencido".

## Consequências

- ✅ **Margem calculável** — preço de custo + snapshot por item = relatório de margem honesto, histórico imutável.
- ✅ **PDV de verdade** — scanner GTIN, pagamento dividido, impressão térmica, orçamento separado, romaneio.
- ✅ **Caixa fiel** — livro caixa cobre receita + saída avulsa, esperado vs contado real.
- ✅ **Compras rastreadas** — custo médio móvel automático, fornecedor cadastrado, NF anotada (sem emitir).
- ✅ **Fiado/crediário** — operação central do varejo SMB BR finalmente coberta.
- ✅ **Relatórios honestos** — DRE simplificado, top produtos, estoque baixo, margem por produto.
- ✅ **Veto fiscal preservado** — Vitrê continua sem emitir nada (ADR-0033). NCM = texto livre, sem cálculo.
- ⚠️ **Dublin v3 high-fidelity adia 2-3 meses**. UI da camada comercial usa shell admin atual (canvas-v1 + Dublin v3 Ondas 0-5i já entregues).
- ⚠️ **Prospects 100% NF-dependentes ainda não migram** — esperado (ADR-0033). ICP é lojista que **não precisa de NF interna**, só de gestão.
- ⚠️ **Refator de PDV** — pagamento dividido obriga rewrite de `createBalcaoSale` action. Vai dar trabalho mas a alternativa (JSON na order) é pior.
- 🔧 **Backfill `order_payment`** — 1 linha por pedido existente lendo `payment_method` + `cash_received_in_cents`. SQL específico no número 45.
- 🔧 **Cleanup futuro** — `order.payment_method` + `order.cash_received_in_cents` ficam por 2 releases e depois são removidos em ADR-0XYZ.
- 🔧 **Cleanup futuro** — `default_commission_bps` em `store` precisa ser adicionado em Camada 5 quando comissão virar feature exposta.

## Régua de prioridade

Quando hesitar entre **polir UI** e **destravar gestão** → sempre gestão.
Quando hesitar entre **clonar GFIL** e **manter simplicidade Vitrê** → sempre simplicidade.
Quando hesitar entre **feature que prospect-sem-pagar pediu** e **feature que cliente pagante usa** → sempre cliente pagante (até primeiro pagamento, prevalece o que destrava prospect concreto da semana).

## Ritual de auditoria entre camadas

**Ao final de cada Camada (2-7)**, antes de iniciar a próxima: mini-auditoria de 1 dia:
- Schema drift check via `drizzle-kit introspect` (Drizzle vs prod)
- RLS audit: toda tabela com `store_id` tem policy ativa? Toda policy testada com user "estranho"?
- Action coverage: toda action é `"use server"`? Loaders são side-effect-free (CLAUDE.md #3)?
- Dead code sweep: componentes/funções não referenciadas viram delete
- Type-check + lint zero-warning
- Atualizar CLAUDE.md com estado novo
- Atualizar `docs/produto/roadmap.md` marcando camada como entregue

Razão: founder verbalizou preocupação com "lixos no back-end" — ritual sistemático previne drift acumulado. Não mexer em limpeza durante construção da camada (regressão risk), só entre.

## Quando reabrir esta decisão

- **Dublin v3 high-fidelity** retoma quando ≥5 clientes pagantes ativos pedirem (mesma régua do ADR-0033).
- **Camadas individuais** podem ser priorizadas/despriorizadas conforme feedback, mas **a ordem causal não muda** — Camada 1 sempre antes de 2, sempre antes de 3, etc.
- **Emissão fiscal**: nunca por iniciativa interna (ADR-0033 régua de 4 condições).

## Visão de longo prazo (1-2 anos, REGISTRADA mas NÃO em escopo)

Founder explicitou em 2026-05-19 que Vitrê deve virar "sistema com peso forte no mercado" em 1-2 anos. Três itens citados:

1. **Multi-filial** (cadastrar filiais sob mesmo CNPJ). Caminho: schema atual com `store_id` já é multi-tenant — adicionar `branch_id NULL` em tabelas operacionais é INCREMENTO, não rewrite. ADR-0035 quando ≥3 pagantes pedirem.
2. **Emissão NF-e nativa**. ADR-0033 já tem régua de 4 condições. **Caminho preferido permanece integração via API com Bling/Tiny** — Vitrê continua sem tocar SEFAZ. Emissão própria só com runway dedicado de 18 meses.
3. **App instalado (Tauri)**. ADR-0017 régua de ≥2 pagantes com dor concreta. PWA atual cobre 95% offline; Tauri custa R$ 1.500/ano cert Windows + sai do free tier.

**Princípio rígido**: "1-2 anos" não vira código antes de 5+ pagantes pedirem. Senão Vitrê vira Bling pior em vez de Vitrê diferenciado.

**Diferencial competitivo a preservar** durante toda a evolução: **loja online integrada nativa**. Vitrê é o único do segmento varejo SMB BR que tem catálogo público real + ISR + SEO + checkout WhatsApp + admin gestão + PDV num só produto. GFIL/Dimas/Bling/Tiny não têm storefront público de fábrica. Toda hora de dev gasta fortalecendo esse moat (coleções, lançamento, recomendação, promoção temporizada, integração marketplace futuro) **aumenta** a vantagem. Toda hora gasta clonando feature GFIL **diminui** — vira commodity.

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes em 2026-05-19. Gatilho: feedback de prospects vendo demo + screenshots GFIL trazidos pra sessão. Plano de execução: Claude Code (sessão 2026-05-19+). Veredito do conselho: REPENSAR Dublin v3 → GO camada comercial mínima.
