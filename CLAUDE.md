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

## Sprint atual: Fase 1.7 — Deploy Vercel + smoke real

**Início**: 2026-05-21
**Objetivo**: tirar o sistema do "pronto em dev" pra "Sandra usando de verdade". Nenhuma feature nova. Subir, validar e seedar.

Fases 0-1.6 ✅ e Sprints 0 → 6 ✅ (fechadas em `docs/sessoes/2026-05-21-fechamento-sprints-0-a-6.md`). Estado: 58/58 SQLs em prod, 491/491 testes verdes, `tsc` limpo, anon bloqueado em 10/10 tabelas.

### Critério de "pronto" (régua sem exceção)

- [ ] `npm run build` produção limpo local (Anderson roda)
- [ ] `.env.example` sincronizado com `.env.local` (mesmas chaves, valores em placeholders)
- [ ] Pooler validado em transaction mode pra produção (DATABASE_URL aponta pro pooler 6543, DIRECT_URL pro 5432)
- [ ] `vercel link` + import do GitHub
- [ ] 13 envs configuradas no painel Vercel em scope `production`
- [ ] Region `gru1` (São Paulo) configurada em `vercel.json`
- [ ] Cron `/api/cron/keep-alive` aparece em Vercel Crons UI
- [ ] Deploy preview da branch funciona com env de staging (se houver) ou rejeita gracioso se Supabase de prod ainda não estiver pronto
- [ ] Smoke test em produção:
  - [ ] `https://<dominio>/sandra-brito` (ou loja seed) renderiza catálogo
  - [ ] Adicionar ao carrinho → finalizar WhatsApp → código curto correto
  - [ ] Login admin → criar produto via câmera mobile → upload OK
  - [ ] Pedido aparece em `/admin/pedidos`
  - [ ] PDV: abrir caixa, vender, fechar caixa Z
- [ ] Lighthouse mobile na home da loja ≥ 90
- [ ] Sandra Brito recebe link funcional + seed de dados reais
- [ ] Esta seção é atualizada com checkboxes marcados antes de seguir pra Fase 2

### Régua de execução (pré-deploy)

- Build local antes de deploy: `npm run build` rodando do zero, sem warning estranho que não seja `<img>` em ReportLayout e exports Zod inferidos sem consumer (esses 27 warnings de lint são conhecidos e não bloqueiam — ficam pra janela de limpeza pós-deploy).
- Anderson é quem faz `vercel link`, configura envs no painel e roda o smoke em prod. Claude prepara checklist e verifica tudo que é local.
- Pooler 6543 (transaction mode) em `DATABASE_URL` de prod; 5432 (direct) em `DIRECT_URL`. Nunca trocar.

---

## Próximas Sprints (planejadas, NÃO em execução)

Não comece código de Sprint futura antes da atual estar com TODOS os checkboxes marcados.

- **Fase 2 — Multi-tenant pleno**: signup self-service sem seed manual, email verification ON, domínio próprio, FORCE RLS + role `vitre_app`, testes automatizados de isolamento. Só começa quando Fase 1.7 fechar com Sandra rodando o sistema.
- **Fase 3 — Monetização**: Vercel Pro, plano Free com limite (X produtos / Y pedidos), plano Pago via Stripe (mensalidade Vitrê, NÃO checkout do lojista).
- **Fase 4+ — Diferenciação**: cupom de desconto avançado, frete grátis acima de X, programa de pontos, integração Correios, subdomínio próprio (`sandra.vitre.com.br`).
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

Windows 11 + PowerShell + VS Code + **Claude Code** (CLI). PT-BR. Repo em `C:\Users\ANDERSON FELIPE\Documents\VITRE\`.

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
- Pivô para Vitrê Gestão 2026-05-15 ([ADR-0012](docs/decisoes/0012-pivot-vitre-gestao.md))
- Fases 2-5 + PWA do pivô ✅ (2026-05-16)
- Veto fiscal explícito 2026-05-19 ([ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md))
- Camada Comercial Vitrê 2026-05-19 ([ADR-0034](docs/decisoes/0034-camada-comercial-vitre.md))
- Sprints 0 → 6 ✅ todas fechadas até 2026-05-21 (`docs/sessoes/2026-05-21-fechamento-sprints-0-a-6.md`)
- Fase 1.7 (deploy) virou Sprint atual em 2026-05-21 — bloqueador real pra Sandra usar

**Norte vivo sobrescreve qualquer ADR conflitante.** Se ADR-0034 disser "5-7 semanas" e este arquivo disser "12-18 semanas", vale este arquivo. ADR é registro de decisão no momento; norte vivo é régua de execução atual.
