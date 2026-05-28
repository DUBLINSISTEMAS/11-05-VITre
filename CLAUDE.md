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
| A receber | `/admin/financeiro/receber` |
| A pagar | `/admin/financeiro/pagar` |
| Recados do site | `/admin/contatos` |

> Nova venda = modal "Nova venda" do topbar / F2. `/admin/pdv` segue vivo como fallback de URL.

**Grupo 2 — Cadastros** (monto uma vez)
Produtos `/admin/produtos` · Categorias · Marcas · Clientes `/admin/clientes` · Grupos de cliente `/admin/clientes/grupos` · Fornecedores

**Grupo 3 — Gestão** (olho pra decidir)
| Item | Rota |
|---|---|
| Resultado | `/admin/relatorios/resultado` |
| Relatórios | `/admin/relatorios` |
| Estoque parado | `/admin/estoque/parado` |
| Estoque vencendo | `/admin/estoque/vencendo` |
| Compras | `/admin/compras` |
| Custo & margem | `/admin/produtos/custos` |

**Grupo 4 — Loja online + Configurações**
Aparência · Banners · Vitrines `/admin/colecoes` · Códigos de desconto `/admin/promocoes/cupons` · Formas de pagamento `/admin/pagamento` · Dados da loja `/admin/configuracoes`

**Suporte** no footer.
**Escondidos do menu (régua funciona-ou-esconde, vivos por URL):** `/admin/atributos`, `/admin/equipe`, `/admin/assinatura`.

---

## Vocabulário canônico (só em labels de UI — nunca em arquivos/rotas/colunas)

Pedido→Venda · Coleção→Vitrine · Lead/Contato→Recado do site · Cupom→Código de desconto · Storefront→Loja online · Tenant/Store→Loja · Stock movement→Movimentação de estoque.
> "Atributo→Filtro da loja" está CONGELADO: a feature de atributos foi escondida (integração storefront quebrada). Não usar essa label até reativar.

## Glossário — estoque
- **Controlar estoque** ON = produto físico que conta (desconta na venda, soma na compra; default true). OFF = serviço/encomenda/consignado.
- **Estoque atual** = somatório de movimentações; não editável direto; corrige via "ajuste manual" com motivo.
- **Mínimo** dispara "estoque baixo" + sino. **Máximo** alimenta "estoque parado".
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

## Estado atual VERIFICADO (2026-05-28)

> Substitui o changelog antigo. Mantém só o que é verdade hoje, conferido no código.

- **Motor de lucro**: `lib/pricing/net-profit.ts` + `load-dre.ts` deduzem CMV+taxa+despesa+devolução. Snapshots gravados na venda. ✅ honesto.
- **Canais reais**: enum `order_channel` só tem `whatsapp` + `balcao`. "Venda externa/InfinitePay" e "Loja online" como canal próprio NÃO existem no banco. ⚠️
- **Faxina pendente** (ver `docs/sessoes/FAXINA-2026-05-28.md`): matar 3 relatórios stub + 2 botões stub + rotas mortas; renomear "Custo & margem"→"Preencher custos"; gerar migration faltante (schema tem colunas sem migration commitada).
- **Construir** (norte do empresário): canal venda externa · meta mensal · comparação anual · automação proativa.

Histórico congelado em `docs/sessoes/` e `docs/decisoes/` (ADRs). Norte vivo sobrescreve ADR conflitante.