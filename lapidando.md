# Lapidando — Mangos Pay

> Doc vivo. Auditoria + plano de reconstrução + diretrizes de execução.
> Atualizado em cada R fechada.
> Não é changelog — é norte vivo. Histórico vai pros commits.

---

## Diretrizes de execução (não-negociáveis)

**Estilo visual**
- Sistema-minimalista, tipo Linear / Notion / Stripe.
- Densidade compacta. Tipografia 13-14px no corpo, 11-12px em meta. Números importantes em **peso (700/600) e cor**, não em tamanho gigante.
- KPI principal: 18-22px no máx, nunca 32-48px de splash. Hierarquia por cor + peso + spacing.
- Whitespace ≠ desperdício. Cada bloco entrega informação ou ação.
- Zero confete visual: sem ilustração genérica, sem ícone enorme, sem caixa "premium". Linha + cor + número.

**Nível de execução**
- Fullstack — schema + action + UI + acessibilidade + mobile + impressão no mesmo passo.
- Toda mudança visual passa por: contraste WCAG AA, foco visível, mobile <640px, modo print.
- Cada `R` entrega ponta-a-ponta. Régua "funciona ou esconde" é lei.

**Engenharia**
- Schema-first. Migration + RLS + CHECK antes da UI.
- Mutações server-only via Route Handler quando o caminho é client-side dinâmico (Server Action em useEffect é unsafe em Turbopack dev — comprovado por telemetria).
- Snapshots minimalistas: gravar valor histórico apenas onde renomear quebra relatório (preço pago, custo no momento, nome do produto). Resto deriva.
- Vocabulário canônico PT-BR varejo. Sem jargão SaaS-EUA.

---

## Estado real do sistema (resumo executivo)

- ~80k linhas (TS/TSX/SQL) pra um escopo equivalente a Bling em 1/3 da complexidade.
- 18 schemas. 26 módulos de actions. PDV é god component de 3.325 linhas.
- **2 sistemas de migration competindo**: `drizzle/*.sql` (40) + `supabase/sql/*` (88). Causa de bugs reincidentes.
- **4 motores de cálculo de lucro** coexistindo. Lojista não sabe qual número confiar.
- Snapshots over-engineered (15 colunas em `order_item`, 5 já bastariam).
- **5 flags binárias** de estado de produto → 32 combinações possíveis.
- Server caindo (OOM Turbopack) é sintoma de bundle inflado, não config.

**Veredito empresário**: "Sistema bonito, várias telas, mas não confio nos números. Volto pro Bling."

---

## Bugs ativos com causa raiz

| # | Bug | Causa raiz | Fix |
|---|---|---|---|
| 1 | Servidor cai ao clicar orçamento PDV | OOM Turbopack (path c/ espaços + bundle inflado) | Workaround `--max-old-space-size=8192`. Permanente: R2 reduz PDV de 3325→~400 linhas/comp |
| 2 | Orçamento "fica em loading" | Server Action em useEffect (bug Turbopack+RSC) | Fix M2.1: Route Handler HTTP. **Padrão: aplicar em todos os drawers globais** |
| 3 | Cadastrar produto às vezes falha | Schema TS adiantado ao banco (2 sistemas de migration) | Migrations aplicadas. Permanente: R1 unifica migrations |
| 4 | Texto verde-sobre-verde ao selecionar | Faltava `::selection` no CSS | Fix M1 |
| 5 | "Não dá pra cadastrar despesa" | UX de descoberta (botão escondido em tab/CTA) | R5 |

---

## Plano de reconstrução — 12 R's

### P0 — Fundamentos (impede uso real)

| R | O que | Estimativa | Depende de |
|---|---|---|---|
| **R1** | Unificar migrations (88 SQLs → migrations Drizzle proper). Drizzle vira fonte única. | 1-2d | — |
| **R2** | Refatorar PDV (3325 linhas → 8 componentes + 1 store Zustand) | 3-4d | — |
| **R3** | Lucro real por venda inline + tela detalhe consume `calculateNetProfit` único | 1d | — |
| **R4** | Dashboard limpo: 1 número grande + 3 alertas + lista densa do dia | 1d | R3 |

### P1 — Confiabilidade do número (impede confiança)

| R | O que | Estimativa | Depende de |
|---|---|---|---|
| **R5** | Despesas com UX clara — CTA descobrível, dialog simples, DRE imediata | 0.5d | — |
| **R6** | Coluna SOBRA dupla na /produtos (à vista + 6× crédito) | 0.5d | R3 |
| **R7** | Custo médio ponderado quando entra mercadoria (compra). Snapshots de venda preservam histórico. | 1d | R1 (schema) |
| **R8** | Separar `product` (vende) de `inventory_item` (gestão interna). Schema novo, UI separada. | 2d | R1 + reset |

### P2 — Coerência e qualidade

| R | O que | Estimativa | Depende de |
|---|---|---|---|
| **R9** | Vocabulário canônico: `order→sale`, `orderItem→saleLine`, etc. | contido em R8 | reset |
| **R10** | Snapshots minimalistas: só `product_name`, `unit_price_paid`, `unit_cost_at_sale` por linha | contido em R8 | reset |
| **R11** | Estado do produto via enum único: `draft|active|paused|archived`. `featured`, `published_to_storefront` separados. | contido em R8 | reset |
| **R12** | Mobile audit + print audit sistemicos | 1d | R3-R8 |

**Total estimado: 12-15 dias sênior focado.**

---

## Relatórios imprimíveis (resposta direta à pergunta)

Sim, vai poder. Plano:

- **Relatório de Lucro** (A4 + CSV) — DRE consolidada do período. Cobertura CMV explícita. Comparação com período anterior em pill.
- **Relatório de Despesas** (A4 + CSV) — agrupado por categoria, total mensal, recorrentes destacadas.
- **Comparativo de período** (A4) — mês vs mês, trimestre vs trimestre, ano vs ano. Tabela densa: receita / despesa / sobra / margem por bloco.
- **Relatório de Vendas** (A4 + CSV) — lista com lucro por venda, método de pagamento, vendedora. Filtros: data, canal, vendedora.

Layout impressão: header padrão (logo loja, CNPJ, data de geração, operador), corpo monoespaçado-tabular, footer com paginação. Trigger: botão "Imprimir" gera `/admin/relatorios/X?formato=a4`. Mesmo padrão da ficha de orçamento que já funciona.

**Onde encaixa nas R's**: depois de R3 (lucro por venda consume helper canônico) + R5 (despesas funcionando) os relatórios viram trivial. Estimativa: 1d a mais.

---

## Reset do banco — escopo proposto (AGUARDANDO CONFIRMAÇÃO LINHA A LINHA)

⚠️ Não executo nada até você dizer **"OK reset"** linha por linha.

### O que será destruído

**Dados**:
- Todas as `store`, `user`, `account`, `session` → TRUNCATE CASCADE
- Todos `customer`, `lead`, `order*`, `product*`, `category`, `brand`, `inventory*`, `stock_movement`, `cash*`, `expense`, `receivable*`, `purchase*`, `supplier`, `banner`, `storefront_collection`, `attribute*`, `team*` → TRUNCATE CASCADE
- Exceção: tabelas internas do `_drizzle_migrations` — será zerada manualmente

**Estrutura redundante**:
- `supabase/sql/*` (88 arquivos) → deletar pasta inteira
- `drizzle/*.sql` existentes → zerar e regenerar como `0000_init.sql` único limpo
- Schemas mortos: `attribute*`, `team_member*`, possivelmente `lead` (decidir antes)

### O que será preservado

- `.env.local` (DATABASE_URL etc)
- Buckets Supabase Storage (regras IAM, não dados)
- `lapidando.md` (este doc)
- Histórico de commits (git)

### Sequência

1. Você confirma escopo item a item
2. Eu faço dump leve do banco pra `.backup/YYYY-MM-DD.sql` local (segurança)
3. Eu rodo TRUNCATE/DROP conforme acordado
4. Eu reescrevo schemas TS limpos (R8/R9/R10/R11 juntos)
5. Eu gero migration única `0000_init.sql` e aplico
6. Você cria primeira loja
7. R1-R6 entram em execução

### Confirmações que preciso ANTES de qualquer SQL destrutivo

- [ ] OK destruir TODAS as `store` (sua loja de teste atual incluída)?
- [ ] OK destruir TODOS os `user` (sua conta atual incluída — você cria de novo)?
- [ ] OK destruir TODOS os `product`, vendas, fiados, compras existentes?
- [ ] OK deletar `supabase/sql/*` inteira?
- [ ] OK fazer dump backup antes (recomendado, mesmo que reset)?
- [ ] OK eu sequenciar reset durante a noite ou prefere acompanhar?

---

## Ordem de execução

**Sessão 1 (FECHADA — 4 commits):**
- ✅ `lapidando.md` criado
- ✅ **R3** Lucro real por venda inline + drawer + `<Money>` component
- ✅ **R5** Despesas UX (dialogs host global em qualquer tab) + KPIs Stripe-style
- ✅ **R4** Dashboard limpo (`ProfitSummary` substitui HeroLucro splash)

**Sessão 2 (próxima):**
- **R6** Coluna SOBRA dupla na /admin/produtos (à vista + 6× crédito)
- **Relatórios A4** — Lucro + Despesas + Comparativo

**Sessão 3 (decisão tua):**
- **R1** Migrations unificadas → pré-requisito do reset
- **Reset do banco** com confirmações item a item
- **R8** Separar product/inventory_item — schema novo limpo

**Sessão 4:**
- **R2** Refatorar PDV em componentes — complexidade alta, vale separar do resto
- **R12** Mobile + Print audit sistêmicos

---

## Princípios não-negociáveis (pra qualquer R)

1. **Schema-first**. Migration + RLS + CHECK antes da UI.
2. **Server-only para mutação**. Route Handler quando UX é client-dinâmico.
3. **`calculateNetProfit` é a ÚNICA fonte de verdade** pra lucro. Qualquer lugar que mostrar lucro consome ele.
4. **Snapshot apenas onde renomear quebra relatório**. Resto vem de relacionamento.
5. **Mobile <640px funciona OU esconde**. Sem desktop-only por inércia.
6. **Print A4 funciona OU não tem botão**. Sem CSS print quebrado.
7. **WCAG AA mínimo**. Contraste 4.5:1 em texto normal, 3:1 em ícones/large text.
8. **Esconder > Mostrar quebrado**. "Funciona ou esconde" é lei.

---

## Glossário canônico (PT-BR varejo)

| Termo | Significa |
|---|---|
| Sobra | Margem por unidade (preço − custo direto), sem taxa cartão. Linguagem balcão. |
| Lucro líquido | Sobra − taxa cartão − comissão − imposto (helper canônico). |
| Despesa | Custo operacional do mês (aluguel, luz, salário). |
| Custo | Custo de aquisição do produto (CMV unitário). |
| Venda | Operação de balcão ou WhatsApp confirmada. |
| Orçamento | Venda futura, ainda não fechada. |
| Fiado | Venda parcialmente paga ou totalmente em aberto. |

Em código: nomes em EN coerentes (`sale`, `saleLine`, `customer`, `payment`). Sem `order` (legado a renomear).

---

## Eu preciso de você

**R3+R5+R4 entregues** (sessão 1, 4 commits). Pode testar:

- `/admin/pedidos` — coluna **Lucro** com cor semafórica + pill global de cobertura CMV
- Drawer de venda — linha **Lucro líquido (margem%)** destacada no Resumo financeiro
- `/admin/financeiro` — CTA "Lançar despesa" funciona em **qualquer tab** (R5 fix), KPIs Stripe-style (sem splash)
- `/admin` (dashboard) — **ProfitSummary** novo: 1 número modesto + breakdown denso + delta + linha "Ontem" secundária

**Pra próxima sessão**: R6 + Relatórios A4 ou pulamos pra R1 + Reset.

**Pra reset do banco**: confirmação item a item da seção acima.
