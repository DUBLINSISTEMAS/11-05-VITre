# Mangos Pay — Norte Operacional

> Documento vivo. Carregado em toda sessão do Claude Code.
> REGRA DE OURO: este arquivo descreve o que o sistema **é hoje**, nunca o que
> "deveria ser". Se a UI muda, este arquivo muda no MESMO commit. Doc ≠ código = bug.
> Histórico e changelog NÃO moram aqui — vão em `docs/sessoes/`.
> Teto rígido: 200 linhas. Passou, é porque entrou changelog que não devia.

---

## O que o Mangos Pay é (decisão fechada)

Sistema de gestão para lojas de pequeno/médio porte (joia, semijoia, roupa, perfumaria, calçados) no interior do Brasil. **Um cérebro (gestão) com 4 canais de venda.** Catálogo público + checkout WhatsApp + admin de gestão + PDV balcão num só produto.

- **ICP**: lojista que NÃO emite NF interna. Mangos Pay não emite NF-e/NFC-e/SPED. NCM = texto livre. (ADR-0033)
- **Diferencial**: loja online nativa integrada — concorrentes (GFIL/Bling/Tiny) não têm storefront de fábrica. Trabalho no storefront fortalece o moat.
- **Domínio**: `vitre.site/{slug}`.

---

## Princípios de execução (inquebráveis)

1. **Vocabulário do varejo BR, não SaaS-EUA.** "Venda" não "Pedido". "Vitrine" não "Coleção". "Recado" não "Lead".
2. **Operação primeiro, polimento depois.** PDV multi-pagamento > etiqueta bonita. Fiado > tema escuro.
3. **Densidade utilitária estilo planilha-de-contador** nas telas de gestão. Brilho só em storefront, login, onboarding, PDP.
4. **Schema-first.** Migration + RLS + CHECK antes da UI.
5. **Append-only quando possível.** Correção via lançamento reverso, não UPDATE.
6. **Snapshot de valores históricos.** Custo na venda, nome do cliente no pedido, preço aplicado — tudo gravado.
7. **Mutação = server action `"use server"`.** Client nunca chama Drizzle. `load*` = leitura pura.
8. **Produto é nó central, não apêndice da loja online.** O cadastro alimenta venda balcão, estoque, margem, fiado, compras E catálogo com peso igual. `isPublishedToStorefront` é UM checkbox, não a moldura do form.
9. **Inteligência espacial.** Campo numérico curto nunca ocupa 100% sozinho (grid 2-3 col). 4+ contextos = abas, não scroll infinito.
10. **Funciona ou esconde.** Feature exposta entrega fluxo ponta-a-ponta, senão sai da UI (rota pode seguir viva por URL).

## Disciplinas anti-bagunça

1. **Nenhum ADR novo com Sprint aberta.** Decisão pequena = commit + comentário.
2. **Feature nova só entra respondendo: "qual fluxo ela completa?"** Se for "pra quando alguém precisar", NÃO constrói. (Atributo, Coleção, Cupom, Lead erraram nisso.)
3. **Toda Sprint termina com auditoria curta:** `tsc --noEmit` zero erro + `npm test` verde + dead-code sweep + **sync deste arquivo**.
4. **Sem prompt amplo pro Claude Code.** Cirúrgico: analisa → mostra diff → espera OK → aplica. Nunca "refatore a sidebar inteira".

---

## Arquitetura da navegação (CANÔNICA — espelha `nav-items.ts`)

Sidebar = **Início + 4 grupos colapsáveis**. Não inventar 5º grupo.
Fonte da verdade: `src/components/admin/shell/nav-items.ts`. Se divergir, o código vence e este bloco é atualizado.

**Início** → `/admin` (dashboard, fora do accordion)

**Grupo 1 — Operação** (faço HOJE)
| Item | Rota |
|---|---|
| Vendas | `/admin/pedidos` |
| Orçamentos | `/admin/orcamentos` |
| Caixa do dia | `/admin/pdv/caixa` |
| Estoque | `/admin/estoque` |
| Financeiro | `/admin/financeiro` |

> Financeiro = tela única com KPI saldo do mês + tabs `?tab=receber|pagar` + 2 CTAs verbais ("Lançar fiado" / "Lançar despesa"). Rotas `/admin/financeiro/receber` e `/admin/financeiro/pagar` viraram redirects server-side em Onda L2 (2026-05-29).

> Nova venda = CTA `<NewSaleButton/>` no header de `/admin/pedidos` + atalho F2 global + Ctrl/Cmd+K. `/admin/pdv` segue vivo como fallback de URL.

**Grupo 2 — Cadastros** (monto uma vez)
Produtos `/admin/produtos` · Clientes `/admin/clientes` · Categorias · Marcas · Fornecedores

**Grupo 3 — Gestão** (olho pra decidir)
| Item | Rota |
|---|---|
| Resultado | `/admin/relatorios/resultado` |
| Relatórios | `/admin/relatorios` |
| Compras | `/admin/compras` |

**Grupo 4 — Loja online**
Aparência · Banners · Vitrines `/admin/colecoes` · Códigos de desconto `/admin/promocoes/cupons` · Formas de pagamento `/admin/pagamento` · Dados da loja `/admin/configuracoes`

**Suporte** no footer.
**Escondidos do menu (régua funciona-ou-esconde, vivos por URL):** `/admin/clientes/grupos` (vira tab interna em /clientes), `/admin/atributos`, `/admin/equipe`, `/admin/assinatura`. `/admin/estoque/parado` e `/admin/estoque/vencendo` viraram redirects pra `/admin/estoque?view=parado|vencendo` em Onda L4.
**Deletados em Onda L1 (2026-05-29):** `/admin/contatos` (Recados do site — feature morta, removida da UI inteira; tabela `lead` preservada porque storefront ainda recebe form de contato), `/admin/produtos/custos` (duplicava /admin/produtos; custo agora vive na aba "Preço & custo" do ProductFormModal).

---

## Vocabulário canônico (só em labels de UI — nunca em arquivos/rotas/colunas)

Pedido→Venda · Coleção→Vitrine · Cupom→Código de desconto · Storefront→Loja online · Tenant/Store→Loja · Stock movement→Movimentação de estoque.

> "Lead/Contato→Recado do site" REMOVIDO em Onda L1 (2026-05-29) — feature morta, UI admin deletada.

> "Atributo→Filtro da loja" está CONGELADO: a feature de atributos foi escondida (integração storefront quebrada). Não usar essa label até reativar.

## Glossário — estoque

- **Controlar estoque** ON = produto físico que conta (desconta na venda, soma na compra; default true). OFF = serviço/encomenda/consignado.
- **Estoque atual** = somatório de movimentações; não editável direto; corrige via "ajuste manual" com motivo.
- **Mínimo** dispara "estoque baixo" + sino. **Máximo** é referência de cobertura/projeção (NÃO alimenta "estoque parado"). "Estoque parado" = produto com saldo > 0 que não vende há ≥60 dias (`loadStockAging`).
- **Unidade**: un, kg, g, m, m², L, ml, par, dúzia (default un).

## Impressão e exportação (universal)

- `<PrintPageButton/>` imprime a página (CSS `@media print` esconde `[data-admin-chrome]`).
- `<ReportLayout/>` = A4 com logo + dados da loja + CNPJ + "Gerado em … por {operador}".
- `<SaleReceiptThermal/>` = cupom 80mm (toggle Térmica ↔ A4).
- Exportar CSV em listagens e relatórios. (Pendência conhecida: vendas exporta só a página atual.)

---

## Convenções técnicas obrigatórias

1. **RLS-first** — toda tabela de domínio tem `store_id`; toda query via `withTenant(storeId,userId,fn)`. Exceção: tabelas better-auth.
2. **Zod em todos os boundaries** (`actions/*/schema.ts`).
3. **Mutações server-only** — `"use server"`; `load*` = leitura sem side-effect.
4. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
5. **Imagens** sharp 800×800 WebP 75% antes do upload, max 5/produto, via `next/image`.
6. **Rate limit** em auth/orders/upload/PDV (`@upstash/ratelimit`); reads sem rate limit.
7. **Slugs reservados** em `src/lib/slug.ts`.
8. **PT-BR em URLs/UI, EN em código** (`attributeTable`, `loadOrderDetail`). Não misturar na mesma camada.
9. **Sem `sql.raw` com input dinâmico** — sempre parametrizado.
10. **Integration tests RLS pré-merge** — mexeu em schema/RLS/grant/`withTenant`: rodar `RUN_INTEGRATION=1 npm run test:integration` e confirmar 40/40 antes de commit.
11. **Auditoria via `recordAuditEvent`** em operações sensíveis, na mesma transação (não-bloqueante).

## Stack

Next 15 + React 19 + TS · Drizzle + Supabase Postgres · Better Auth (só lojista) · Supabase Storage · shadcn/ui + Tailwind v4 · react-hook-form + Zod 4 · Sonner · Resend · Upstash · sharp · Sentry · Vercel.
**Não usamos**: Stripe, Supabase Auth, Prisma, NextAuth, Electron.

## O que NÃO fazer

❌ Stripe no checkout · ❌ login de cliente final (carrinho/favoritos em localStorage, ADR-0008) · ❌ NF-e/SEFAZ (ADR-0033) · ❌ acesso remoto no produto (ADR-0018) · ❌ pular RLS · ❌ imagem sem compressão · ❌ mutação sem `revalidateTag` · ❌ feature sem fluxo claro · ❌ form coluna-única com numérico curto a 100% · ❌ produto como apêndice da loja · ❌ `window.confirm/alert` em venda (usar AlertDialog) · ❌ `formatBRL` local (importar de `@/lib/pricing`).

## Ambiente & Founder

Windows 11 + PowerShell + VS Code + Claude Code. PT-BR.
Anderson Felipe — dev solo. Aplica `/arrow-skill` em decisões substanciais. Estilo copiloto+piloto: age, não pergunta a cada passo; confirma antes de operação destrutiva. Quer dev sênior, zero amadorismo.

## ADR só se TODOS forem verdade

Muda/cria tabela · consequência irreversível em ≤30 dias · outro dev precisa do porquê. Senão = commit + comentário.

---

## Estado atual VERIFICADO (2026-05-29)

> Substitui o changelog antigo. Mantém só o que é verdade hoje, conferido no código.

- **Motor de lucro**: `lib/pricing/net-profit.ts` + `load-dre.ts` deduzem CMV+taxa+despesa+devolução. Snapshots gravados na venda. ✅ honesto.
- **Cadastro de produto**: abre como modal fullscreen (`ProductFormModal` 92vh/1400px max, Bloco F 2026-05-29 — substituiu Drawer Sheet) com 7 abas. Materiais somados atualizam o custo do produto no form e no banco. CTA "abrir produto" aceita `initialTab` pra deep-link em aba específica.
- **Canais reais**: enum `order_channel` só tem `whatsapp` + `balcao`. "Venda externa/InfinitePay" e "Loja online" como canal próprio NÃO existem no banco. ⚠️
- **Onda L1 fechada (2026-05-29)** — limpeza estrutural pedida pelo founder: **DELETADAS** `/admin/contatos` (Recados do site — feature morta) e `/admin/produtos/custos` (cards grandes duplicando /admin/produtos). Sidebar minimalista: 4 grupos com 17 itens visíveis (era 25). 3 referências de link pra `/admin/produtos/custos` redirecionadas pra `/admin/produtos`. `loadCustoProducts`, `update-cost-batch`, `LeadsReport`, `leadsAgg` (dashboard) e tudo da UI admin de leads removido. Tabela `lead` preservada (storefront ainda recebe via `submitContact`). Migration 0037+0038+0039 aplicadas no banco do founder (estavam pendentes).
- **Onda L2 fechada (2026-05-29)** — Financeiro como planilha. "A receber" + "A pagar" consolidados em UMA tela `/admin/financeiro` com tabs `?tab=receber|pagar`. Header `FinanceiroOverview` central: H1 + 2 CTAs verbais ("Lançar fiado" / "Lançar despesa" via eventos `OPEN_NEW_RECEIVABLE_EVENT` / `OPEN_NEW_EXPENSE_EVENT`) + 4 KPIs (Recebido este mês / Pago este mês / **Saldo do mês** em destaque cream + ícone / Em aberto). Nova action `loadFinanceiroOverview` calcula tudo em 1 transação. `ExpensesPageClient` ganhou prop `embedded` que esconde header+KPIs próprios quando dentro da tela consolidada. Rotas antigas `/financeiro/receber` e `/financeiro/pagar` viraram redirects server-side (`redirect("/admin/financeiro?tab=*")`). Sidebar: 17 → 16 itens (1 menos). Vocabulário verbal aplicado: "Lançar fiado / Lançar despesa" (verbos), "Recebido / Pago / Saldo / Em aberto" (varejo BR, não Receita/Despesa de SaaS-EUA).
- **Onda L3 fechada (2026-05-29)** — Produto enxuto. ProductForm consolidado **7 → 4 abas**: Básico (identidade+fotos) / Preço & Custo (preço+custo+comissão+simulador margem inline) / Estoque (track+qty+min/max+variantes) / Mais (catálogo público+promo+atacado+NCM+apparel). Tabs antigas `imagens`, `precificacao`, `variantes`, `loja` mergeadas. `OpenProductFormEventDetail.initialTab` union atualizada. `/admin/produtos` ganhou coluna **SOBRA** (era MARGEM%) — `formatBRL(preço − custo)` com cor semafórica (verde ≥10%, amarelo <10%, vermelho prejuízo; "Sem custo" amarelo italic quando NULL). Filtro nova `?status=no-cost` + tab "Sem custo · N" na ProductsStatusTabs substitui a tela `/admin/produtos/custos` (deletada em L1): lojista filtra, abre produto, cadastra custo. Action de COUNT ganhou bucket `noCost` (1 query agregada).
- **Onda L4 fechada (2026-05-29)** — Estoque consolidado. `/admin/estoque/parado` e `/admin/estoque/vencendo` viraram tabs internas (`?view=parado|vencendo`) — eram rotas separadas, agora redirects server-side. `EstoqueViewTabs` foi de 3 tabs (Saldo/Movimentações/Alertas) pra **5 tabs** com contadores nos pills (parado e vencendo). `loadStockAging` e `loadExpiringBatches` agora carregam em paralelo na page principal, alimentando KPIs + tabela inline (`ParkedView` + `ExpiringView` substituem as pages standalone). `/admin/estoque/contagem` segue como rota separada (é form de batch, não listagem). Bug L2 colateral fixado no mesmo deploy: `loadFinanceiroOverview` usava `receivable_payment.paid_at` inexistente — trocado por `createdAt` (cada payment é o ato de receber em si).
- **Onda L5 fechada (2026-05-29)** — Loja online opt-in. Grupo 4 da sidebar (`loja-config`) agora renderiza como `<details>` HTML nativo (CSS-only accordion) quando a loja não tem produto publicado — fechado por default mostrando label "Loja online" + hint verde "Configurar" + chevron rotativo. Layout do admin server-renderiza `hasStorefront` (count `is_published_to_storefront=true AND is_active=true > 0`) e propaga via `AdminShell → AdminSidebar → SidebarContent`. Outros 3 grupos seguem planos. Modo sidebar collapsed (72px só ícones) bypassa o opt-in. Zero JS, zero state — preferência do user não persiste; quem dita o default é a existência de produto publicado.
- **Onda L6 fechada (2026-05-29)** — Cleanup final da transformação L1-L6. `LojaOnlineSnapshot` no dashboard ganha gate idêntico ao L5: quando 0 publicados E 0 sem foto, retorna null (esconde bloco inteiro em vez de mostrar "Nenhum produto publicado" perpétuo). Comentários históricos de rotas mortas limpos em `nav-items.ts`, `submit-contact.ts`, `[storeSlug]/contato/page.tsx` — refletem o estado real pós-L1 (recados sem painel admin, custos sem tela própria). Inspeção de rotas órfãs: nenhuma encontrada — todas as 43 pages do admin têm uso ou redirect declarado. Não normalizei `orderTable→saleTable` no schema TS porque seria refactor amplo (toca 50+ arquivos) sem ganho operacional — vocabulário "Vendas" só na UI já cumpre o princípio do CLAUDE.md.
- **Onda 2 fechada** (2026-05-28) — lucro líquido completo: PDV grava `commission_snapshot_in_cents` no `order_item` em todos os 3 INSERTs (sale + fiado + quote); `load-dre.ts` agrega `SUM(commission_snapshot)`; `/admin/relatorios/resultado` mostra linha "Comissão de vendedoras" no waterfall.
- **Transformação L1-L6 fechada (2026-05-29)** — 6 ondas em 1 dia transformaram o sistema de 4 grupos × 25 itens (founder rejeitou: "muito feio, sem lógica") em 4 grupos × 16 itens + 1 opt-in. Telas duplicadas deletadas (custos, recados), telas fragmentadas consolidadas (financeiro, estoque), form de produto enxuto (7→4 abas), planilha financeira com KPI saldo, sidebar dinâmica baseada em estado real da loja. 2375 linhas deletadas em L1 sozinha; ~700+ linhas adicionadas em L2-L5 pra consolidar; cleanup L6 pro último ruído de doc.
- **Construir** (norte do empresário): canal venda externa · meta mensal · comparação anual · automação proativa.

Histórico congelado em `docs/sessoes/` e `docs/decisoes/` (ADRs). Norte vivo sobrescreve ADR conflitante.
