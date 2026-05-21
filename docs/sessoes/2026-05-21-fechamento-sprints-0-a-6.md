# 2026-05-21 — Fechamento Sprints 0 → 6

Arquivo histórico. Capturado no momento em que CLAUDE.md foi atualizado
pra apontar Fase 1.7 (deploy) como Sprint atual.

Estado real do repo: 267 commits no `main`. Tudo planejado em CLAUDE.md
pré-deploy está commitado. Resumo abaixo por sprint, com os commits
chave pra rastrear.

---

## Sprint 0 — Shell admin reorganizado ✅

**Status**: todos os critérios marcados, fechada em 2026-05-20.

Critérios cumpridos:
- Sidebar reorganizada em 4 grupos (`71fc41a`)
- Vocabulário canônico aplicado em 6 telas (`50c12a8`, `fb886b8`, `c7782d5`, `d935772`, `61a7d52`, `e7bf033`, `28305fd`)
- ProductDialog: registrado como no-op (já consolidado em auditoria 2026-05-12 — ver `docs/sessoes/2026-05-20-sprint-0-prompt-4-noop.md`)
- Dashboard `/admin` refeito com 4 cards de operação (`e4afc81`)
- Form de produto em 5 abas (`b7c6de4`)
- Migration `brand` preparada (`55c2f56`)
- Dead code sweep (`7892f32`)
- Tipos em `use server` movidos pra `types.ts` (`fbd4b52`)
- Lint zero warning, tsc zero error

Débitos para Sprint 1 (resolvidos depois):
- 6 testes falhando pré-existentes → resolvidos em sprints 1.5+
- StockInput readonly em edit → mantido editável, decisão registrada em `tab-estoque.tsx`

### Prompts originais da Sprint 0 (arquivo — não re-executar)

Os 7 prompts foram a régua de execução da sessão. Mantidos aqui pra
referência histórica e como exemplo de prompt cirúrgico estilo Anderson.

**Prompt 1 — Mapeamento da sidebar atual**: leitura sem modificar,
output do caminho exato, lista de itens, estrutura.

**Prompt 2 — Reorganização da sidebar**: 4 grupos com cabeçalho,
mantendo rotas, itens futuros como disabled+tooltip "em breve".

**Prompt 3 — Vocabulário em onda**: 6 telas, uma por vez, substituir
apenas strings JSX visíveis (não identifiers/rotas/queries).

**Prompt 4 — Consolidação do ProductDialog**: análise sem código, plano
de migração. Veio a ser no-op (auditoria de 2026-05-12 já tinha
consolidado).

**Prompt 5 — Dashboard `/admin` refeito**: 4 cards (Caixa, A receber,
Estoque baixo, Venda ontem), mantendo SalesSummaryCard + RecentOrdersTable.

**Prompt 6 — Form de produto em 5 abas**: Identidade · Preço & Custo ·
Estoque · Variantes · Loja online, com sub-cards e grid 2/3 colunas
para campos numéricos curtos. Migration `brand` preparada como step
separado.

**Prompt 7 — Dead code sweep + auditoria de fechamento**: ts-prune,
componentes/actions órfãos, ADRs conflitantes. Aplicar deletes em
commit separado, rodar bateria final.

---

## Sprint 1 — Operação do dia ✅

PDV multi-pagamento, scanner GTIN, atalhos F2-F9, status orçamento,
fiado, fechamento de caixa. Commits chave:

- `037c4ce` — createBalcaoSale aceita pagamento dividido
- `5d16172` — UI de pagamento dividido
- `d7831c9` — scanner GTIN + atalhos F2-F9
- `afa4b0e` — migration status orçamento + quote_valid_until
- `8d762ef` — createBalcaoSale aceita mode quote
- `a443553` — UI orçamento com "transformar em venda"
- `6746795` — fiado: lançar venda com receivable

## Sprint 1.5 — Limpeza pós-auditoria 2026-05-21 ✅

4 ondas: higiene de código, componentes UI órfãos, segurança (rate
limit em 3 mutations + remover sql.raw), CLAUDE.md.

- `795cb87` `3705f8d` `91f5a68` `e9a5706`
- Auditoria documentada em `docs/auditoria-2026-05-21/`

## Sprint 2 — Cadastros refeitos ✅

- `8cb7fc3` — brand CRUD `/admin/marcas` + integração no form
- `9f93077` — supplier CRUD `/admin/fornecedores`
- `6689802` — cliente com saldo fiado + `/admin/financeiro/receber`
- `618f148` — modo criação rápida vs completa
- `0aa9059` — etiqueta com código de barras

## Sprint 3 — Compras + custo médio ✅

- `057679c` — createPurchase com custo médio móvel ponderado
- `3a65cf8` — UI `/admin/compras`
- `bb66abe` — contagem física em batch `/admin/estoque/contagem`

## Sprint 4 — Fiado + financeiro ✅

- `5649c7b` — receivable_payment append-only (Sprint 4A)
- `c6953eb` — pagamento parcial + dialog drilldown
- `2e08af8` — fiado parcial direto na venda balcão
- `6a5cb88` — fiado avulso sem venda associada

## Sprint 5 — Relatórios A4 ✅

- `c30b9f4` — 5 relatórios A4 imprimíveis + index

## Sprint 6 — Segurança hardening ✅

Pre-Sprint-6 (devolução + estorno append-only):
- `c73c619` — sentinelas
- `0ecd9a7` — estorno de pagamento de fiado
- `a89c2a1` — devolução de venda balcão

Sprint 6 propriamente dito:
- `27c33c8` — audit log de eventos críticos (Sprint 6A)
- `1c39d7f` — sentinelas de security headers + CSP (Sprint 6B)
- `25fa62a` — magic bytes em uploads de imagem (Sprint 6C)
- `7113c19` — SECURITY DEFINER audit + IDOR smoke (Sprint 6D)
- `e6f9d81` — cobertura de rate limit + defesa em profundidade (Sprint 6E)

## Pós-Sprint 6 — PDV polish ✅

- `7086a03` — fix orçamento/fiado quebrados por CHECK obsoleto (SQL 57)
- `f77b456` — fix TDZ cashSessionIdForOrder
- `da5d5e7` — redesign PDV: modal produto + carrinho denso + sem scroll

---

## Estado pré-Fase 1.7

- 491/491 testes passam, 0 fail
- `tsc --noEmit` limpo
- 58/58 SQLs aplicados em prod
- 10/10 tabelas bloqueadas pra anon
- 27 warnings de lint benignos (tipos Zod inferidos sem consumer +
  1 `<img>` em ReportLayout — esses ficam pra próxima janela de limpeza
  ou pra Sprint dedicada se incomodarem)

Próximo bloqueio real: Fase 1.7 (deploy Vercel).
