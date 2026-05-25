# Mangos Pay — Norte Operacional

> Documento vivo. Carregado automaticamente em toda sessão do Claude Code.
> Atualizar a seção "Sprint atual" a cada Sprint fechada.
> Quando passar de 400 linhas, mover histórico antigo pra `docs/sessoes/`.

---

## O que o Mangos Pay é (decisão fechada, não revisitar)

Sistema de gestão para lojas de pequeno/médio porte (joia, semijoia, roupa, perfumaria, calçados, acessórios) em cidades do interior do Brasil. Catálogo público + checkout WhatsApp + admin de gestão + PDV balcão num só produto.

**ICP**: lojista que **não emite NF interna** (NF fica em sistema do contador ou via Bling/Tiny). Mangos Pay NÃO emite NF-e/NFC-e/SPED. NCM = texto livre para futura integração externa. Ver ADR-0033.

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

## Sprint atual: Fase 2 — Multi-tenant pleno

**Início**: 2026-05-21
**Objetivo**: fundação segura pra qualquer lojista entrar via signup self-service, sem seed manual. Quando o primeiro lojista real (Sandra ou outro) for criado, vai ser via fluxo público, não script.

**Contexto da decisão**: Fase 1.7 (deploy técnico) encerrada em 2026-05-21 com deploy Vercel feito mas smoke real descartado — Anderson decidiu terminar o sistema antes de expor a lojista real, evitando que o primeiro cliente entre via seed que viraria dívida de produto. Detalhes em `docs/sessoes/2026-05-21-encerramento-fase-1.7.md`.

Estado de partida (atualizado 2026-05-24): 70 SQLs em prod, 533/533 testes verdes (+ 39 skipped que rodam só com `RUN_INTEGRATION=1`), `tsc` limpo, anon bloqueado em 10/10 tabelas, deploy Vercel em produção (sem tráfego real ainda).

### Critério de "pronto" (5 blocos — ordem importa, não pular pra frente)

**Bloco 1 — Isolamento real** ✅ **DONE (descoberto em auditoria 2026-05-21)**
- [x] Role `vitre_app` criada com `NOBYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE` (`supabase/sql/09_app_role_setup.sql`)
- [x] `DATABASE_URL` aponta pra `vitre_app` (`.env.local` + Vercel env); `DIRECT_URL` mantém `postgres` pra migrations
- [x] `FORCE ROW LEVEL SECURITY` em todas as 32 tabelas de domínio (sqls 10, 29, 31-36, 39, 46, 49, 53, 55, 56)
- [x] `withTenant` é único caminho autenticado (`src/lib/tenant.ts`); `withServiceRole(reason, fn)` loga toda exceção legítima cross-tenant
- [x] Verificação cross-tenant: `npm run db:smoke-idor` (manual, saída humana) + `RUN_INTEGRATION=1 npm test` (automatizado, ver Bloco 2)

**Bloco 2 — Validação automatizada** ✅ **DONE em 2026-05-21**
- [x] Suite `tests/integration/rls-cross-tenant.test.ts` cobre cross-tenant SELECT em 18 tabelas privadas (order, order_item, order_payment, order_return, order_return_item, customer, customer_group, receivable, receivable_payment, cash_session, cash_adjustment, stock_movement, supplier, purchase, purchase_item, audit_event, lead, coupon)
- [x] Sanity-check: teste falha se `DATABASE_URL` apontar pra `postgres` (BYPASSRLS invalida o teste)
- [x] Smoke manual (`scripts/smoke-idor.mjs`) mantido com saída humana pra pré-deploy
- [x] Cenários **INSERT cross-tenant** (WITH CHECK ou FK rejeita) em 5 tabelas (product, customer, supplier, cash_session, lead) — descobriu e fechou buraco em `lead_anon_insert` (SQL 58)
- [x] Cenários **UPDATE cross-tenant** (USING bloqueia, rowCount=0) nas mesmas 5 tabelas
- [x] Gate pré-merge documentado (ver "Convenção #10" abaixo). Job CI dedicado com DB ephemeral defer pra Fase 5 (custo: ~meio dia + manutenção do schema do test DB)
- [x] Auditoria curta: `npm test` 533/533 + `tsc --noEmit` zero warning + `RUN_INTEGRATION=1 npm run test:integration` 39/39

**Bloco 3 — Signup self-service (substitui seed manual)**
- [ ] Tela `/cadastro` cria usuário Better Auth + loja em transação atômica
- [ ] Wizard pós-signup: nome da loja, slug (com colisão handling), tipo de negócio, primeira categoria, primeiro produto
- [ ] Slugs reservados (`src/lib/slug.ts`) respeitados no cadastro
- [ ] Loja recém-criada já entra com config padrão (formas de pagamento default, aparência default)
- [ ] Sem dependência de script — qualquer pessoa com email cria loja em ≤3 min

**Bloco 4 — Hardening de auth**
- [ ] Email verification ON no Better Auth (sem verificar = sem login)
- [ ] Template de email transacional com identidade Mangos Pay (Resend)
- [ ] Domínio próprio verificado no Resend (sair de `onboarding@resend.dev`)
- [ ] Rate limit em `/api/auth/sign-up` e `/api/auth/sign-in` (≤5/min por IP)
- [ ] Senha mínima + revogação de sessão antiga em troca de senha

**Bloco 5 — Roteamento multi-tenant**
- [ ] Subdomínio (`{slug}.mangospay.app` → loja `{slug}`) via middleware Next.js
- [ ] OU domínio próprio do lojista via CNAME (decisão de design fica pro início do bloco)
- [ ] Resolução DNS → storeSlug → rendering correto
- [ ] Documentação curta em `/admin/configuracoes` ensinando o lojista a configurar DNS

### Régua de execução

- Cada bloco fecha com mini-auditoria (testes verdes + tsc limpo + RLS audit) antes do próximo
- Bloco 1 e 2 são bloqueantes — sem eles, não tem multi-tenant. Não começar Bloco 3 antes
- Sem ADR novo dentro da Fase (regra meta-1). Decisão pontual = commit com mensagem clara
- Pendências carregadas da Fase 1.7 (rever antes do primeiro lojista real entrar):
  - ~~`vercel.json` não tem `regions: ["gru1"]` declarado~~ — verificado 2026-05-24: já está em `vercel.json:3`
  - ~~HMAC sigs dos crons em `vercel.json` ainda são placeholders~~ — verificado 2026-05-24: sigs reais (256-bit hex) já estão lá
  - Smoke test prod (storefront / WhatsApp / câmera / PDV) deferido pro setup do primeiro lojista real
  - Lighthouse mobile ≥ 90 deferido pelo mesmo motivo

### Sprint flash 2026-05-24 (auditoria pós-conselho-5-agentes)

Anderson fez dogfooding e atribuiu nota 4/10. 5 agentes Explore varreram o admin; conselho identificou: motor sólido, casca quebrava régua "funciona-ou-esconde" em 3 pontos visíveis, parcelamento de cartão (P0 BR) faltando, bug status confundindo. Executados em ~3h:

- [x] Esconder do menu: `/admin/assinatura` (Stripe Fase 3), `/admin/atributos` (schema produto sem vínculo), "Estoque baixo" em Gestão (duplicava `/admin/estoque`) — `nav-items.ts`
- [x] Bug status: venda balcão nascia `'fulfilled'`, foi pra `'confirmed'` — lojista marca cumprida quando entrega via botão existente. `create-balcao-sale.ts:1086` + sentinela atualizada
- [x] `window.confirm()` do orçamento → AlertDialog shadcn — UX consistente com resto do admin
- [x] `trackStock` default `true` (era `false`) + migration SQL 69 retroativa — bug do "produto somindo de /admin/estoque" eliminado
- [x] **Parcelamento de cartão ponta-a-ponta**: coluna `order_payment.installments` (SQL 70) + Zod validação ("só credit pode >1") + dropdown 1-12x no PDV + persist + display "Crédito 3x" no recibo. Mangos Pay registra escolha, NÃO calcula juros (maquininha do lojista cobra a taxa)
- [x] Sync deste documento

Régua aplicada: **feature na UI tem que entregar fluxo comum, senão esconde**. Equipe, Atributos, Assinatura e Estoque-baixo escondidos por isso. Rotas seguem vivas por URL pra reativação futura sem refator.

---

## Próximas Sprints (planejadas, NÃO em execução)

Não comece código de Sprint futura antes da atual estar com TODOS os checkboxes marcados.

- **Fase 3 — Monetização**: Vercel Pro, plano Free com limite (X produtos / Y pedidos), plano Pago via Stripe (mensalidade Mangos Pay, NÃO checkout do lojista). Só começa quando Fase 2 fechar.
- **Fase 4+ — Diferenciação**: cupom de desconto avançado, frete grátis acima de X, programa de pontos, integração Correios.
- **Fase 5 — Onboarding do primeiro lojista real**: criar conta da Sandra (ou outro piloto) via signup self-service da Fase 2, importar produtos via planilha, smoke test real em prod, Lighthouse mobile ≥ 90 com dado real. NÃO antes da Fase 2 fechar.
- **Sprint 6 follow-ups** (defensivos opcionais): 2FA pro lojista, refator `pdv-shell.tsx` (2154 linhas) e `create-balcao-sale.ts` (1141 linhas) — fazer junto da próxima feature que tocar nesses arquivos.

Sprints 0 → 6 ✅ concluídas (resumo em `docs/sessoes/2026-05-21-fechamento-sprints-0-a-6.md`).

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
10. **Integration tests RLS pré-merge** — qualquer mudança em: schema de tabela com `store_id`, policy RLS, role/grant, `withTenant` / `withServiceRole`, ou nas suites `tests/integration/*` exige rodar localmente `RUN_INTEGRATION=1 npm run test:integration` e confirmar 39/39 verde **antes** de commit/merge. CI hoje só faz unit (`npm test`) — gate de integration roda contra DB real e ainda não tem DB ephemeral na pipeline (defer Fase 5). Esse é o cinto que pegou o vazamento de `lead_anon_insert` (SQL 58); pular ele = vazamento volta sem aviso.

## Stack (não revisitar sem problema concreto)

Next 15 + React 19 + TypeScript · Drizzle ORM + Supabase Postgres · Better Auth (somente lojista) · Supabase Storage · shadcn/ui + Tailwind v4 · TanStack Query · react-hook-form + Zod · Sonner · Resend · Upstash Ratelimit · sharp · Vercel.

**Não usamos**: Stripe (lojista vende pelo WhatsApp ou POS físico), Supabase Auth, Prisma, NextAuth, Electron.

## O que NÃO fazer

- ❌ Adicionar Stripe ao checkout (lojista cobra fora do Mangos Pay)
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

Windows 11 + PowerShell + VS Code + **Claude Code** (CLI). PT-BR. Repo em `C:\Users\ANDERSON FELIPE\Documents\Mangos Pay\`.

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

Estado de fases até 2026-05-21 vive em:
- `docs/decisoes/` (ADRs 0001-0034, ordem cronológica)
- `docs/sessoes/` (logs de sessões importantes)
- `docs/auditoria-2026-05-21/` (5 docs read-only do estado do código pré-Sprint 2)
- `docs/produto/roadmap.md` (checklist por fase do MVP catálogo — pendente: Fase 1.7)
- `docs/CONTEXT.md` (briefing 1-minuto pré-pivô)

Marcos:
- MVP catálogo (Fases 0-1.6) ✅
- Redesign canvas-v1 ✅
- Auditoria pré-deploy 2026-05-10 (7 ondas) ✅
- Pivô para Mangos Pay Gestão 2026-05-15 ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md))
- Fases 2-5 + PWA do pivô ✅ (2026-05-16)
- Veto fiscal explícito 2026-05-19 ([ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md))
- Camada Comercial Mangos Pay 2026-05-19 ([ADR-0034](docs/decisoes/0034-camada-comercial-vitre.md))
- Sprints 0 → 6 ✅ todas fechadas até 2026-05-21 (`docs/sessoes/2026-05-21-fechamento-sprints-0-a-6.md`)
- Fase 1.7 (deploy técnico) encerrada 2026-05-21 com deploy Vercel feito; smoke real descartado junto com Sandra — primeiro lojista real entra via signup self-service depois da Fase 2 (`docs/sessoes/2026-05-21-encerramento-fase-1.7.md`)
- Fase 2 (Multi-tenant pleno) virou Sprint atual em 2026-05-21 — bloqueador real pra qualquer lojista entrar com segurança

**Norte vivo sobrescreve qualquer ADR conflitante.** Se ADR-0034 disser "5-7 semanas" e este arquivo disser "12-18 semanas", vale este arquivo. ADR é registro de decisão no momento; norte vivo é régua de execução atual.
