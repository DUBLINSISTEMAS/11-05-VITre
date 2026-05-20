# Vitrê — Norte Operacional

> Documento vivo. Carregado automaticamente em toda sessão do Claude Code.
> Atualizar a seção "Sprint atual" a cada Sprint fechada.
> Quando passar de 400 linhas, mover histórico antigo pra `docs/sessoes/`.

---

## O que o Vitrê é (decisão fechada, não revisitar)

Sistema de gestão para lojas de pequeno/médio porte (joia, semijoia, roupa, perfumaria, calçados, acessórios) em cidades do interior do Brasil. Catálogo público + checkout WhatsApp + admin de gestão + PDV balcão num só produto.

**ICP**: lojista que **não emite NF interna** (NF fica em sistema do contador ou via Bling/Tiny). Vitrê NÃO emite NF-e/NFC-e/SPED. NCM = texto livre para futura integração externa. Ver ADR-0033.

**Diferencial defensável**: loja online integrada nativa. Concorrentes (GFIL/Bling/Tiny/Dimas) NÃO têm storefront público de fábrica. Todo trabalho no storefront fortalece moat; todo trabalho clonando GFIL diminui.

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

---

## Disciplinas anti-bagunça (meta-regras)

1. **Nenhum ADR novo enquanto Sprint atual estiver aberta.** Decisão pequena = commit + comentário. ADR só pra mudança estrutural irreversível.
2. **Nenhuma feature nova entra sem responder: "qual fluxo essa feature completa?"** Se for "vai ficar disponível pra quando alguém precisar", NÃO constrói. Atributo, Coleção, Cupom, Lead já foram construídos assim — não repetir.
3. **Toda Sprint termina com auditoria de 1 dia.** Schema drift, RLS audit, dead code sweep, type-check zero warning. Sem isso, drift acumula.
4. **Sem prompt amplo pro Claude Code.** Prompt é cirúrgico: analisa → mostra diff → espera aprovação humana → aplica. Não "refatore toda a sidebar"; sim "leia X, liste Y, proponha Z, espere meu OK".

---

## Arquitetura da navegação (canônica)

Sidebar do admin tem **4 grupos**, cada um com 4-6 itens. Lojista que abre o admin entende em 30 segundos sem texto explicativo. Não inventar quinto grupo.

### Grupo 1 — Operação (o que faço HOJE)

| Item | Rota |
|---|---|
| Venda balcão (PDV) | `/admin/pdv` |
| Caixa do dia | `/admin/pdv/caixa` |
| Vendas | `/admin/pedidos` |
| Movimentação de estoque | `/admin/estoque` |
| A receber (fiado) | `/admin/financeiro/receber` *(Sprint 4)* |
| Recados do site | `/admin/contatos` |

### Grupo 2 — Cadastros (monto UMA VEZ, mexo pouco)

| Item | Rota |
|---|---|
| Produtos | `/admin/produtos` |
| Categorias | `/admin/categorias` |
| Marcas | `/admin/marcas` *(Sprint 2)* |
| Clientes | `/admin/clientes` |
| Grupos de cliente | `/admin/clientes/grupos` |
| Fornecedores | `/admin/fornecedores` *(Sprint 3)* |

### Grupo 3 — Gestão (OLHO pra decidir)

| Item | Rota |
|---|---|
| Vendas por período | `/admin/relatorios/vendas` *(Sprint 5)* |
| Margem por produto | `/admin/relatorios/margem` *(Sprint 5)* |
| Top produtos | `/admin/relatorios/top` *(Sprint 5)* |
| Estoque baixo | `/admin/estoque/relatorio` |
| DRE simplificado | `/admin/relatorios/dre` *(Sprint 5)* |
| Compras | `/admin/compras` *(Sprint 3)* |
| Custo & margem (batch) | `/admin/produtos/custos` |

### Grupo 4 — Loja online + Configurações (AJUSTO esporadicamente)

| Item | Rota |
|---|---|
| Aparência | `/admin/aparencia` |
| Banners | `/admin/banners` |
| Vitrines (coleções) | `/admin/colecoes` |
| Filtros da loja (atributos) | `/admin/atributos` |
| Códigos de desconto (cupons) | `/admin/promocoes/cupons` |
| Formas de pagamento | `/admin/pagamento` |
| Equipe | `/admin/equipe` |
| Dados da loja | `/admin/configuracoes` |
| Plano e assinatura | `/admin/assinatura` |

Item "Suporte" sai da sidebar principal — vira link discreto no footer da sidebar ou no menu do avatar do usuário.

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

Os termos do controle de estoque confundem porque hoje os labels do form não explicam pra que serve cada um. Toda tela que use estes campos DEVE usar exatamente as labels e helpers abaixo. Sem variação.

**Controlar estoque** (switch on/off)
- *ON*: produto físico que precisa contar (joia, roupa, perfume). Sistema desconta automático a cada venda, soma a cada compra. Se zera, alerta no PDV antes de finalizar (configurável: bloqueia ou só avisa).
- *OFF*: serviço, produto sob encomenda, consignado. Sistema deixa vender sem checar quantidade. NÃO entra em relatórios de estoque baixo.
- Helper visível: *"Deixe ligado se você conta as peças. Desligue para serviços ou produtos sob encomenda."*

**Estoque atual** (número, calculado)
- Não é editável por digitação direta. É resultado do somatório de movimentações: compras (+), vendas (−), devoluções (+), ajustes manuais (±), perdas (−).
- Pra corrigir, lojista usa "Lançar ajuste manual" com motivo obrigatório.
- Link inline: *"Ver movimentações"* → leva pra `/admin/estoque` filtrado.

**Estoque mínimo** (número, opcional)
- Quando estoque atual cai a ou abaixo deste valor, o produto aparece no card "Estoque baixo" do dashboard e no relatório dedicado.
- É alerta de reposição, NÃO bloqueia venda.
- Helper visível: *"Quando o estoque atingir esse número, avisamos que está na hora de comprar mais."*

**Estoque máximo** (número, opcional)
- Útil para relatório de "estoque parado" (capital empatado em produto que não gira). Sem uso operacional direto.
- Helper visível: *"Limite acima do qual consideramos estoque parado. Deixe em branco se não controla."*

**Unidade** (select: un, kg, g, m, m², L, ml, par, dúzia)
- Default 'un'. Aplicado em label visível no PDV, recibos, relatórios.
- Helper visível: *"Como você conta esse produto na hora da venda."*

---

## Impressão e exportação — padrão universal

Princípio do sistema, não feature isolada. Toda tela do Grupo 3 (Gestão) tem dois botões fixos no topo direito: **Imprimir** e **Exportar CSV**.

- **Imprimir** abre página nova DENTRO do próprio sistema (não popup) com layout A4 — cabeçalho com logo da loja, nome, CNPJ, endereço, telefone; corpo com os dados; rodapé com "Gerado em DD/MM/AAAA HH:MM por {operador}". `Ctrl+P` ou botão Imprimir do navegador manda pra impressora. Detecta impressora térmica 80mm e quebra layout pra coluna estreita (mesmo dado, formatação adaptada).
- **Exportar CSV** baixa o CSV bruto pra Excel/contadora manipular.
- PDV imprime cupom 80mm como padrão; orçamento imprime A4 com cabeçalho completo + opção 80mm; fechamento de caixa Z imprime A4 + 80mm.
- Componente único: `<ReportLayout />` (Sprint 5) — todo papel impresso do sistema compartilha a mesma identidade visual.

---

## Sprint atual: Sprint 0 — Shell admin reorganizado

**Início**: 2026-05-19
**Fim previsto**: 2026-06-02 (10-14 dias)
**Objetivo**: matar a sensação de "feito por IA". Nenhuma feature nova. Arrumar a casa.

### Critério de "pronto" (régua sem exceção)

- [ ] Sidebar reorganizada em 4 grupos com cabeçalhos
- [ ] Todas as rotas existentes funcionando após reorganização
- [ ] Vocabulário canônico aplicado em sidebar + headers de página + breadcrumbs
- [ ] `ProductDialog` consolidado em UM ponto de montagem
- [ ] Dashboard `/admin` refeito: 4 cards de operação do dia (sem checklist de setup, sem QuickActions)
- [ ] Form de produto reorganizado em abas (Identidade · Preço & Custo · Estoque · Variantes · Loja online), aplicando princípios 8 e 9 sem exceção
- [ ] Dead code sweep: componentes/funções não referenciados removidos
- [ ] `npm run lint` zero warning, `tsc --noEmit` zero error
- [ ] `npm run db:check` + `npm run db:check-anon` passando
- [ ] Eu (Anderson) abro o admin como se fosse um lojista novo e completo "criar produto + lançar venda balcão" sem abrir 3 abas
- [ ] Esta seção é atualizada com checkboxes marcados antes de iniciar Sprint 1

### Prompts iniciais para o Claude Code (executar em ordem, esperar aprovação entre cada)

#### Prompt 1 — Mapeamento da sidebar atual

```
Leia o arquivo que renderiza a sidebar do admin (provavelmente em
src/components/admin/admin-sidebar.tsx, admin-layout.tsx, ou similar).
Não modifique nada.

Output esperado:
- Caminho exato do arquivo
- Lista de TODOS os itens de navegação com: label atual, href, ícone usado
- Estrutura atual (flat? agrupada?)
- Outros arquivos que importam ou montam navegação

Espere minha confirmação antes de seguir.
```

#### Prompt 2 — Reorganização da sidebar

```
Reorganize a sidebar em 4 grupos com cabeçalho conforme tabela em CLAUDE.md
seção "Arquitetura da navegação".

REGRAS:
- Mantenha TODAS as rotas atuais funcionando — apenas reorganiza visualmente
- Aplique vocabulário novo (CLAUDE.md tabela "Vocabulário canônico") aos labels
- Itens marcados *(Sprint 2/3/4/5)* ainda não existem como rota: renderizar
  como item disabled com tooltip "em breve", NÃO como link 404
- Use o componente de cabeçalho de grupo que combinar com o design atual
  (consulte tokens em src/app/globals.css)
- NÃO altere ícones existentes; se precisar de novo, use lucide-react
- Item "Suporte" sai da sidebar principal: vira link discreto no footer da
  sidebar ou no menu do avatar do usuário

Output esperado: diff completo do arquivo da sidebar. Não commite ainda.
Mostre o resultado e espere minha aprovação.
```

#### Prompt 3 — Vocabulário em onda (uma tela por vez)

```
Aplique o vocabulário canônico (CLAUDE.md) na seguinte ordem,
UMA TELA POR VEZ, parando após cada uma para minha aprovação:

1. src/app/(admin)/admin/pedidos/page.tsx + componentes filhos imediatos
2. src/app/(admin)/admin/promocoes/cupons/ + componentes
3. src/app/(admin)/admin/atributos/page.tsx
4. src/app/(admin)/admin/colecoes/page.tsx
5. src/app/(admin)/admin/contatos/page.tsx
6. src/app/(admin)/admin/pagamento/page.tsx

REGRAS:
- Substituir APENAS strings em JSX/JSX-like (labels, headings, toasts,
  breadcrumbs, empty states, mensagens de erro visíveis ao usuário)
- NÃO renomear identifiers TypeScript, nomes de função, nomes de arquivo,
  rotas, paths de URL, nomes de coluna em queries
- NÃO alterar testes (testes mantêm vocabulário técnico)
- Preserve copy de tom (placeholders, hints) — adapta gramaticalmente

Após cada tela: mostre diff, espere aprovação, só depois passa pra próxima.
```

#### Prompt 4 — Consolidação do ProductDialog

```
Analise (sem modificar) os 3 sites onde ProductDialog é montado na página
/admin/produtos:
- src/components/admin/product-create-gate.tsx
- src/components/admin/product-create-button.tsx
- src/components/admin/products-table.tsx

Documentado em docs/sessoes/2026-05-12-auditoria-senior-pendencias.md
(primeiro item crítico).

Output esperado (sem código ainda):
- Para cada site: qual gatilho dispara o dialog, qual estado mantém,
  qual handler de close
- Proposta de consolidação: qual fica como ponto canônico, qual vira
  consumer do estado, qual deleta
- Plano de migração em passos numerados
- Estimativa de risco (testes que precisam atualizar, rotas afetadas)

Espere aprovação. NÃO comece o refactor agora.
```

#### Prompt 5 — Dashboard `/admin` refeito

```
Reescreva src/app/(admin)/admin/page.tsx removendo:
- QuickActions
- SetupChecklist
- A saudação "Olá, {firstName}!" (substituir por título "Hoje")

Substituir por uma grid de 4 cards de operação do dia, nesta ordem:

1. CARD "Caixa"
   - Se cash_session ativa: mostra opening + saldo esperado (do calculate)
     + duração + CTA "Ver caixa" → /admin/pdv/caixa
   - Se nenhuma: mostra "Caixa fechado" + CTA "Abrir caixa" → /admin/pdv/caixa
   - Use loadActiveCashSession() já existente

2. CARD "A receber"
   - Total pendente em R$ (SUM receivable.amount_in_cents WHERE paid_at IS NULL)
   - Total vencido em R$ (WHERE paid_at IS NULL AND due_date < now())
   - CTA "Ver fiados" → /admin/financeiro/receber (rota não existe ainda,
     renderizar como botão disabled com tooltip "disponível na Sprint 4")

3. CARD "Estoque baixo"
   - Count de produtos onde stock_quantity <= min_stock_quantity
     E min_stock_quantity IS NOT NULL E track_stock = true
   - CTA "Ver lista" → /admin/estoque/relatorio (já existe)

4. CARD "Venda ontem"
   - Total em R$ + count de ordens onde DATE(created_at) = CURRENT_DATE - 1
     E status IN ('confirmed','fulfilled')
   - Sem CTA (link inline no count → /admin/pedidos?de=ontem&ate=ontem)

ABAIXO da grid de 4 cards: manter SalesSummaryCard (gráfico de receita) e
RecentOrdersTable (últimas 5 vendas) — esses dois já existem e funcionam.

Use mesma query pattern do código atual (withTenant + drizzle). Mantenha
1 round-trip de DB (1 query agregada por card é OK; evitar 1 query por
linha de result).

Output esperado: diff de page.tsx + arquivos novos de componentes de card.
Espere aprovação antes de commit.
```

#### Prompt 6 — Form de produto em 5 abas com inteligência espacial

```
Refatore src/components/admin/product-form.tsx (1111 linhas atual)
em 5 abas navegáveis, aplicando rigorosamente os princípios 8 e 9
do CLAUDE.md.

REGRAS DE LAYOUT (princípio 9):
- Campos numéricos curtos (preço, custo, %, quantidades, GTIN, código
  interno): SEMPRE em grid de 2 ou 3 colunas. Nunca um campo numérico
  curto sozinho ocupando 100% da largura.
- Campos texto longo (descrição, composição, observação): ocupam 100%.
- Campos relacionados ficam visualmente agrupados em sub-cards com
  título, espaço 16-20px entre grupos.
- Largura máxima do conteúdo da aba: 760px (centralizado em telas
  maiores). Evitar campos com 1200px de largura em monitor wide.

DIVISÃO DAS ABAS:

1. "Identidade"
   - Sub-card "Básico": nome (100%), descrição curta (100%), descrição
     longa rich-text (100%)
   - Sub-card "Classificação": marca (select com botão "+ Nova marca"
     inline) | categoria (select com "+ Nova categoria") — grid 2 colunas
   - Sub-card "Mídia": ImageUploader (mantém atual)

2. "Preço & Custo"
   - Sub-card "Venda": preço de venda | preço promocional | preço de
     atacado — grid 3 colunas
   - Sub-card "Custo": custo do produto | margem calculada (readonly,
     com cálculo ao vivo: %, R$ por unidade) | comissão padrão — grid
     3 colunas
   - Sub-card "Tributação": NCM (campo texto, helper "Texto livre para
     integração futura com Bling/Tiny") — largura 200px, não 100%

3. "Estoque"
   - Sub-card "Como controlar": switch "Controlar estoque" (largo, com
     helper longo conforme glossário do CLAUDE.md)
   - Sub-card "Quantidades" (só visível se controlar=ON): estoque atual
     readonly com link "Ver movimentações" | estoque mínimo | estoque
     máximo — grid 3 colunas
   - Sub-card "Identificação": GTIN | código interno | unidade — grid
     3 colunas. Helpers do glossário aplicados em CADA campo.

4. "Variantes"
   - VariantEditor (mantém atual)

5. "Loja online"
   - Sub-card "Publicação": switch publicar no catálogo | switch destacar
     na home — grid 2 colunas
   - Sub-card "Catálogo": atributos pra filtros (multi-select),
     parcelas override, desconto à vista override
   - Sub-card "Conteúdo do storefront": composição, modelagem, forro,
     lavagem (esses 4 só fazem sentido pro catálogo público — saem
     da aba Identidade)

REGRAS GERAIS:
- Aba "Identidade" abre por default
- Indicador visual de "campos pendentes" em aba: badge com count de
  erros do react-hook-form daquela aba
- Cada aba em arquivo separado em src/components/admin/product-form/
  (tab-identidade.tsx, tab-preco-custo.tsx, etc.)
- product-form.tsx vira shell que orquestra tabs + submit
- 100% do comportamento atual preservado, todos os testes passando
- "+ Nova marca" inline: dialog que cria marca e popula select sem sair
  do form (cria registro mesmo se o form pai não foi salvo — marca é
  entidade independente)

Output esperado: árvore de arquivos novos + diff de product-form.tsx +
proposta de migration para tabela `brand` (separadamente, espera meu OK
antes de criar). Espere aprovação entre cada parte.
```

#### Prompt 7 — Dead code sweep + auditoria de fechamento

```
Auditoria final da Sprint 0. Execute em ordem:

1. `npx ts-prune` (instalar se não tiver) ou equivalente —
   listar exports não usados em src/
2. Identificar componentes em src/components/admin/ não referenciados
   por nenhuma página
3. Identificar actions em src/actions/ não chamadas
4. Listar arquivos em docs/decisoes/ que contradizem o estado atual
   (ex: ADR-0019 marcado como "parked" — confirmar que está)

Para cada item dead/conflitante: propor delete OU mover para
_legacy/ (criar pasta se não existir) — não delete sem minha aprovação.

Após meu OK: aplicar deletes em commit separado titulado
"chore(sprint-0): dead code sweep".

Final: rodar `npm run lint`, `npx tsc --noEmit`, `npm run test`,
`npm run db:check`, `npm run db:check-anon`. Reportar qualquer falha.
```

---

## Próximas Sprints (planejadas, NÃO em execução)

Atualizar conforme cada Sprint anterior fechar. Não comece código de Sprint futura antes da atual estar com TODOS os checkboxes marcados.

- **Sprint 1 — Operação do dia (3-4 semanas)**: PDV multi-pagamento, scanner GTIN, atalhos F2-F9, impressão térmica 80mm, status "orçamento", caixa com pagar conta/sangria/suprimento, fechamento Z em A4+80mm
- **Sprint 2 — Cadastros refeitos (2-3 semanas)**: tabela `brand` com CRUD em `/admin/marcas` (substitui texto livre); cliente com saldo fiado + histórico; fornecedor (CRUD); modo "criação rápida" vs "edição completa" do produto; etiqueta com código de barras
- **Sprint 3 — Compras + custo médio (2-3 semanas)**: `/admin/compras`, `/admin/fornecedores`, trigger custo médio móvel ponderado, contagem física com ajuste em batch
- **Sprint 4 — Fiado + financeiro (1-2 semanas)**: `/admin/financeiro/receber`, lançar fiado no PDV, dashboard com card vivo
- **Sprint 5 — Relatórios A4 (2 semanas)**: componente `<ReportLayout />`, aplicado em Vendas/Margem/Top/Estoque baixo/Fiado/DRE/Vendas por vendedor. Componente também alimenta cabeçalho de orçamento e fechamento de caixa
- **Sprint 6 — Segurança hardening (1-2 semanas, pós-MVP)**: audit log (tabela `audit_event`), CSP headers no Next, rate limit em mais endpoints, 2FA opcional pro lojista, verificação de magic bytes em uploads, revisão de queries com `SECURITY DEFINER`, smoke test manual de IDOR

Total honesto: 12-18 semanas dev solo. ADR-0034 estimando 5-7 semanas é otimista por 2-3x.

---

## Convenções técnicas obrigatórias (não revisitar sem dor concreta)

1. **RLS-first** — toda tabela de domínio carrega `store_id`; toda query passa por `withTenant(storeId, userId, fn)`. Ver `src/lib/tenant.ts`. Exceções intencionais: tabelas do better-auth (`user`, `session`, `account`, `verification`) não têm RLS — o provider gerencia próprio isolamento via session token.
2. **Zod em todos os boundaries** — server actions, env vars, route handlers. Schema em `actions/*/schema.ts`, importado por client e server.
3. **Mutações server-only** — client nunca chama Drizzle. Sempre `"use server"`. Ações com prefixo `load*` são leituras async pra dialogs client, sem side-effects.
4. **`revalidateTag('store-${slug}')`** em toda mutação que afeta catálogo público.
5. **Imagens** — sharp 800×800 WebP 75% ANTES do upload. Max 5 imagens/produto. Servidas via `next/image`.
6. **Rate limit** — endpoints sensíveis (auth, orders, upload, PDV) protegidos via `@upstash/ratelimit`. Toda mutation `"use server"` chama `checkRateLimit(rateLimits.mutation, userId)`; reads (`load*`, `search*`) ficam sem rate limit (autenticadas + escopadas via RLS).
7. **Slugs reservados** — ver lista em `src/lib/slug.ts`.
8. **Naming PT-vs-EN** — URLs e UI strings em PT-BR (vocabulário do lojista: `/admin/aparencia`, `"Filtros da loja"`). Pastas, identifiers TypeScript e nomes de função em EN (convenção dev: `attributeTable`, `loadOrderDetail`). Nunca misturar dentro da mesma camada.
9. **Sem `sql.raw`** — todo input no SQL deve ser parametrizado (Drizzle template tag `sql\`\`` faz isso automaticamente). Se precisar interpolar valor dinâmico, calcule server-side antes (ex: `new Date(Date.now() - days * 86400000)` em vez de `sql.raw(\`interval '${days} days'\`)`).

## Stack (não revisitar sem problema concreto)

Next 15 + React 19 + TypeScript · Drizzle ORM + Supabase Postgres · Better Auth (somente lojista) · Supabase Storage · shadcn/ui + Tailwind v4 · TanStack Query · react-hook-form + Zod · Sonner · Resend · Upstash Ratelimit · sharp · Vercel.

**Não usamos**: Stripe (lojista vende pelo WhatsApp ou POS físico), Supabase Auth, Prisma, NextAuth, Electron.

## O que NÃO fazer

- ❌ Adicionar Stripe ao checkout (lojista cobra fora do Vitrê)
- ❌ Cadastro/login de cliente final no storefront. Carrinho em localStorage. Favoritos em localStorage. Reafirmado [ADR-0008](docs/decisoes/0008-ux-catalogo-publico-storefront.md)
- ❌ NF-e, SEFAZ, integração fiscal. [ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md)
- ❌ Acesso remoto/captura de tela dentro do produto. Suporte = AnyDesk fora do produto. [ADR-0018](docs/decisoes/0018-suporte-remoto-fora-do-produto.md)
- ❌ Pular RLS "pra facilitar"
- ❌ Subir imagens sem compressão
- ❌ Fazer mutação sem `revalidateTag`
- ❌ Pular ADR antes do código quando a mudança é estrutural — MAS não criar ADR pra decisão pequena (regra meta-1)
- ❌ Construir feature sem fluxo de uso claro
- ❌ Formulário em coluna única com campos numéricos curtos ocupando 100% (princípio 9)
- ❌ Tratar produto como apêndice da loja online (princípio 8)

## Ambiente

Windows 11 + PowerShell + VS Code + **Claude Code** (CLI). PT-BR. Repo em `C:\Users\ANDERSON FELIPE\Documents\catálogo\`.

## Founder

Anderson Felipe — dev solo, PT-BR. Aplica `/arrow-skill` (conselho-5-agentes) em decisões substanciais. Quer abordagem de dev sênior, sem amadorismo. Confirma antes de operações destrutivas.

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

---

## Histórico (congelado — não editar)

Estado de fases até 2026-05-19 vive em:
- `docs/decisoes/` (ADRs 0001-0034, ordem cronológica)
- `docs/sessoes/` (logs de sessões importantes)
- `docs/produto/roadmap.md` (checklist por fase do MVP catálogo)
- `docs/CONTEXT.md` (briefing 1-minuto pré-pivô)

Marcos:
- MVP catálogo (Fases 0-1.6) ✅
- Redesign canvas-v1 ✅
- Auditoria pré-deploy 2026-05-10 (7 ondas) ✅
- Pivô para Vitrê Gestão 2026-05-15 ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md))
- Fases 2-5 + PWA do pivô ✅ (2026-05-16)
- Veto fiscal explícito 2026-05-19 ([ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md))
- Camada Comercial Vitrê 2026-05-19 ([ADR-0034](docs/decisoes/0034-camada-comercial-vitre.md)) — Camada 1 schema aplicada, Camadas 2-7 em curso via Sprints
- Fase 1.7 (deploy) NÃO necessária no momento — sistema continua sem cliente real até Sprint 1 fechar

**Norte vivo sobrescreve qualquer ADR conflitante.** Se ADR-0034 disser "5-7 semanas" e este arquivo disser "12-18 semanas", vale este arquivo. ADR é registro de decisão no momento; norte vivo é régua de execução atual.
