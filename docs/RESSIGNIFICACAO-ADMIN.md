# Ressignificação do Admin Mangos Pay

> **Documento vivo.** Atualizado a cada fase concluída.
> Início: 2026-05-27. Sprint planejada: 5 semanas.
> Disparado pelo feedback presencial do cliente (joalheiro) + auditoria sênior cruzada (3 agentes em paralelo).
>
> **Memória do paradigma**: `.claude/projects/.../memory/ressignificacao-admin-2026-05-27.md`

---

## 1. Norte estratégico

### O paradigma (não revisitar sem dor concreta)

**O sistema é UM cérebro com 4 canais de venda.** Cérebro = gestão. Canais = PDV / WhatsApp / Loja online / Venda externa (InfinitePay/manual). Loja online é UM canal entre 4, NÃO o sistema. Hoje o painel trata loja online como sistema todo — isso é o erro-raiz percebido como "amadorismo".

### Os 3 universos de "produto"

| Universo | Conceito | Tem custo? | Tem preço? | Aparece no PDV? | Aparece na loja online? |
|---|---|---|---|---|---|
| **Item de gestão pura** | matéria-prima, mostruário, ativo | ✅ | ❌ | ❌ | ❌ |
| **Produto comercializável** | vende no balcão/atendimento | ✅ | ✅ | ✅ | ❌ por default |
| **Catálogo público** | subset publicado na loja online | ✅ | ✅ | ✅ | ✅ |

**Resolução pragmática (decidida)**: NÃO criar 3 tabelas, NÃO renomear `product`. Adicionar enum `kind` (raw_material/finished_good/service) + manter `is_published_to_storefront`. UI guiada por intenção via forms separados (ações encadeadas, não form monolítico).

### As 7 perguntas-mãe (toda tela precisa servir uma)

| # | Pergunta | Tela canônica | Frequência |
|---|---|---|---|
| 1 | Quanto sobrou esse mês? | `/admin/resultado` (NOVA — não existe) | Semanal/mensal |
| 2 | O que vendi hoje/semana? | `/admin/pedidos` | Diária |
| 3 | Quanto tenho no estoque? | `/admin/estoque` | Diária |
| 4 | Quanto vale meu estoque? | `/admin/estoque/relatorio` + `/admin/produtos/custos` | Mensal |
| 5 | Quem me deve? | `/admin/financeiro/receber` | Semanal |
| 6 | Quanto tenho a pagar? | `/admin/financeiro/pagar` | Semanal |
| 7 | Como tá indo a loja online? | `/admin` (dashboard) — hoje fraco em analytics | Diária |

---

## 2. Diagnóstico — estado atual (auditoria 2026-05-27)

### 2.1 Cobertura das 7 perguntas-mãe

| # | Pergunta | Score | Gap principal |
|---|---|---|---|
| 1 | Quanto sobrou? | **6/10** | DRE mostra só lucro BRUTO (não desconta `expense`). Sem tela "Resultado" unificada. |
| 2 | O que vendi? | **9/10** | Bem servido (`/admin/pedidos` + dashboard + top produtos) |
| 3 | Quanto tenho no estoque? | **9/10** | Completo (snapshot + parado + vencendo + contagem + relatório A4) |
| 4 | Quanto vale meu estoque? | **8/10** | `/admin/produtos/custos` precisa preenchimento manual (depende disciplina) |
| 5 | Quem me deve? | **9/10** | Múltiplos ângulos (cliente / fiado / pedido / relatório A4) |
| 6 | Quanto tenho a pagar? | **6/10** | Listagem sim, mas SEM KPI agregado no dashboard ("R$ X em contas abertas") |
| 7 | Como tá a loja online? | **3/10** | Só telas de config (aparência, banners, vitrines). ZERO analytics (visitas, conversão, abandono) |

### 2.2 Inventário de telas (47 page.tsx)

**Distribuição:**
- **KEEP (23)**: telas que servem pergunta-mãe direta, sem alternativa.
- **REFINE (4)**: `aparencia/preview` (mock-only), `atributos` (CRUD funciona mas integração storefront incompleta), `colecoes` (manual-only, sem auto-rules), `contatos` (só listagem, sem workflow).
- **MERGE (0)**: zero duplicações reais.
- **KILL (6)**: rotas legacy substituídas por drawer global + features desativadas.

**Rotas pra MATAR:**
| Rota | Motivo |
|---|---|
| `/admin/assinatura/page.tsx` | `notFound()` permanente até Fase 3 Stripe — remover do código |
| `/admin/equipe/page.tsx` | `notFound()` permanente — store_membership não plugado em `getCurrentStore` |
| `/admin/clientes/novo/page.tsx` | Legacy redirect — drawer global cobre via `?customer=new` |
| `/admin/clientes/[id]/page.tsx` | Legacy redirect — drawer global cobre via `?customer=<id>` |
| `/admin/produtos/novo/page.tsx` | Legacy redirect — drawer global cobre via `?edit=new` |
| `/admin/produtos/[id]/page.tsx` | Legacy redirect — drawer global cobre via `?edit=<id>` |

### 2.3 Inventário de tabelas (34 entidades)

**Distribuição:**
- **VIVAS (32)**: schema + CRUD UI ativo
- **PARCIAIS (2)**:
  - `audit_event`: só INSERT, ZERO query/UI de leitura (escreve, ninguém lê)
  - `product_related`: storefront lê fallback automático, sem UI admin de curadoria
- **ÓRFÃS (0)**: todas têm pelo menos 1 referência

### 2.4 Campos misturando universos

**Tabela `product`** — campos por universo (gap conceitual a resolver via UI):

| Universo | Campos atuais em `product` |
|---|---|
| **Só gestão pura** | `cost_price_in_cents`, `min/max_stock_quantity`, `weight_grams`, `internal_code`, `gtin`, `ncm`, `track_stock`, `allow_oversell`, `default_commission_bps` |
| **Comercializável + catálogo** | `base_price_in_cents`, `wholesale_price_in_cents`, `promo_price_in_cents`, `promo_starts_at/ends_at`, `installments_override`, `cash_discount_override_bps` |
| **Só catálogo público** | `composition`, `modeling`, `lining`, `washing`, `description`, `slug`, `is_featured`, `meta_*` |
| **Ambos** | `is_active`, `is_published_to_storefront`, `stock_quantity`, `category_id`, `brand_id`, `unit`, `name` |

**Achado crítico do agente 3** (`src/components/admin/product-form/tab-loja-online.tsx:112-150`):
> Campos `installments_override` + `cash_discount_override` ESTÃO na aba "Loja online" — mas afetam **TODOS os canais** (PDV, WhatsApp, loja online). Lojista pensa que é só pra loja online e fica confuso quando o PDV usa as mesmas regras.

**Decisão**: mover esses 2 overrides pra aba "Preço & Custo". Aba "Loja online" só fica com campos exclusivamente de loja online (composition/modeling/etc + isFeatured + isPublished).

### 2.5 Snapshots históricos — gaps

**Existem (bom):**
- `order_item.unit_cost_snapshot_in_cents` (S2.6)
- `order_item.product_name_snapshot` + `variant_name_snapshot` + `image_url_snapshot` + `price_in_cents_snapshot` (ADR-0034)
- `purchase_item.unit_cost_in_cents` + `batch_number` + `expires_at` (S3.4)
- `cash_session.closing_expected/actual`
- `order.customer_name_snapshot` + `customer_phone_snapshot`
- `lead.product_snapshot`

**Faltam (críticos pra DRE honesto e lucro líquido real por transação):**
- ❌ `order_payment.card_fee_snapshot_in_cents` — taxa real do cartão **no momento** da transação. Hoje usa `store.card_real_fee_bps_*` global (drift se lojista mudar taxa). **BLOQUEIA cálculo de lucro líquido por transação.**
- ❌ `order_item.commission_snapshot_in_cents` — comissão calculada da vendedora **na transação**. Hoje recalcula.
- ❌ `receivable_payment.late_fee_snapshot_bps` + `interest_snapshot_bps` — multa/juros aplicados. Hoje calcula dinamicamente a partir de `receivable.late_fee_bps` (que pode ser editado retroativo).

### 2.6 Sinais de "amadorismo" — diagnóstico calibrado

**O painel NÃO é amador em design.** Layout limpo, sem gradients decorativos, sem glassmorphism em telas de gestão, sem Lottie/illustrations gratuitas. Vocabulário PT-BR varejista 90% correto (vestígios mínimos).

**O amadorismo percebido é ARQUITETURAL:**

1. **🔴 CRÍTICO — Confusão gestão × loja online**: o form de produto mistura overrides operacionais com campos editoriais da loja online. Lojista não sabe o que afeta cada canal. Identificado em `tab-loja-online.tsx:112-150` e `products-table.tsx:39-72`.

2. **🔴 CRÍTICO — Promessas não entregues visíveis**: `ImportCsvStubButton` (botão "em breve" disabled), aviso amarelo em `/admin/atributos` ("em construção pixel-perfect"). Cliente clica, espera funcionar, não funciona = corrosão de confiança.

3. **🟡 MODERADO — "Loja online + Configurações"** como label longo no menu sugere "tudo junto, não organizado".

4. **🟡 MODERADO — Densidade abaixo do esperado**: `metric-card.tsx`, `op-card.tsx` com paddings generosos (`gap-2`, `gap-3`, `b3-card-pad`) parecem SaaS-US bonito-vazio em vez de Bling denso-tabelado-direto. Não é "feio" — é menos denso do que o ICP varejo BR espera.

5. **🟡 MODERADO — "Nova venda" inconsistente**: em `/admin/pedidos` é botão "Adicionar"; em `/admin` é `NewSaleButton` modal; sem atalho gigante sticky de qualquer página. Lojista faz isso 50× por dia, precisa de 1 clique.

6. **🟢 BAIXO — Vocabulário**: 90% correto. Resto é vestígio interno (`RevenueAnalyticsChart` no nome do componente — não vaza pra UI).

---

## 3. Decisões duras (já tomadas — NÃO reabrir sem disrupção real)

1. **Schema MANTÉM `product`** — renomear é cirurgia destrutiva em 80+ SQLs vivas sem ROI.
2. **Adiciona enum `product.kind`** (raw_material/finished_good/service) — separa universos sem nova tabela.
3. **Helper canônico `calculateNetProfit`** em `src/lib/pricing/net-profit.ts` é fonte única da verdade pra TUDO que mostra lucro.
4. **Snapshots completos no `order_item` + `order_payment`** entram na migration #82 — sem isso, DRE mente em 6 meses.
5. **`settlement_days` em `payment_method`** entra desde já — desbloqueia "Fluxo de caixa real" sem migration nova depois.
6. **Margem visível no PDV** via gate `view_margins` (dono vê, vendedora não vê por default).
7. **Custos vêm do cadastro (snapshot automático)** — NÃO digitação manual por venda. Single source of truth.
8. **Breakdown de custo é OPCIONAL** (toggle simples/composto) — atende joia sem atrapalhar revenda.
9. **Lançamento manual de venda externa COM guardião** (badge "{N} vendas externas não conferidas").
10. **Dashboard começa com 3 insights, não 10** — Lucro do período + Top 3 por margem + Alerta margem negativa.

---

## 4. Plano de execução — 5 semanas

### 📋 Semana 1 — Auditoria + Plano (atual)

**Status**: ✅ Auditoria concluída. Documento vivo (este aqui).

**Próximo passo**: validar com founder os pontos abertos (seção 7) e seguir pra Semana 2.

### 🛠️ Semana 2 — Fundação invisível + 1ª vitrine visível

**Entregáveis:**

1. **`src/lib/pricing/net-profit.ts`** — helper canônico
   - Input: `{ price, cost, paymentMethod, parcelas, commissionPct, taxPct, discountInCents }`
   - Output: `{ revenue, cost, paymentFee, commission, tax, netProfit, netMarginPct }`
   - Testes: 12 cenários (PIX / débito / crédito 1x / crédito 12x s/juros / crédito 12x c/juros / fiado / sem comissão / com imposto / custo zero / desconto / devolução / venda externa)

2. **Migration #82** (idempotente, backward-compatible):
   - `ALTER TABLE product ADD COLUMN kind TEXT NOT NULL DEFAULT 'finished_good'` (enum raw_material/finished_good/service)
   - `ALTER TABLE payment_method ADD COLUMN settlement_days INTEGER NOT NULL DEFAULT 0`
   - `ALTER TABLE payment_method ADD COLUMN category TEXT NOT NULL DEFAULT 'other'` (debito/credito/pix/dinheiro/fiado/outro)
   - `ALTER TABLE order_payment ADD COLUMN card_fee_snapshot_in_cents BIGINT`
   - `ALTER TABLE order_item ADD COLUMN commission_snapshot_in_cents BIGINT`
   - `ALTER TABLE receivable_payment ADD COLUMN late_fee_snapshot_bps INTEGER, ADD COLUMN interest_snapshot_bps INTEGER`

3. **Integrar snapshots no `createOrder` + `create-from-cart` + `recordReceivablePayment`** — gravar via helper canônico.

4. **Aba Precificação em `/admin/produtos/[id]`** — Workbench read-only consumindo o helper. Tabela viva com colunas: Forma de pagamento / Recebe / Custo / Lucro R$ / Lucro %. Linhas em vermelho (<5%), amarelo (5-15%), verde (>15%). Botão "Aplicar preço".

**Visível pro cliente**: SIM (aba Precificação).

### 💰 Semana 3 — Lucro no centro ✅ FECHADA

**Entregáveis:**

1. **Tela `/admin/resultado`** (NOVA — pergunta-mãe #1) — ✅ commit `7a1a851` (Bloco E):
   - Equação completa: Faturamento − CMV − Taxas de cartão − Comissões − Despesas = **LUCRO LÍQUIDO**
   - Default: semana atual + comparação semana anterior
   - Toggles: 7/30/90 dias
   - Export CSV + PDF (reuso `<ReportLayout/>`)
   - Adiciona ao Grupo 3 — Gestão (topo)

2. **Refundação `/admin` (dashboard)** — ✅ Bloco F commits A→E (2026-05-28).
   **Pós-conselho 2026-05-28**: plano original revisado em 4 blocos curados
   em vez de 7 itens enfileirados (resolve cry-wolf + scope creep).
   Entregue:
   - **Bloco F.0** (`9f035a2`) — `installmentsOverride` + `cashDiscountOverrideBps`
     moveram de "Loja online" pra "Preço & Custo" com tooltip "vale em todos
     os canais". Quick win paralelo que mata "amadorismo" pela raiz.
   - **Bloco F.2.1** (`30d5262`) — **Hero de Lucro HONESTO**. 2 colunas:
     "Você lucrou R$ X ontem" (vs mesmo dia da semana anterior) + "R$ Y
     essa semana" (vs mesma janela 7d atrás). Breakdown denso (Faturou −
     Custo − Taxa − Despesa = Sobrou). Gate de honestidade: cobertura CMV
     < 80% mostra warning amarelo com CTA pro cadastro de custos. Vendas
     sem snapshot completo são EXCLUÍDAS, não estimadas.
   - **Bloco F.2.2** (`585629a`) — **"Pegando fogo agora"** (substitui
     "Tarefas de hoje" com curadoria DELTA, anti-cry-wolf). 4 sinais:
     caixa esquecido (>12h), WhatsApp pendente (>2h), fiado vencido/hoje,
     estoque NOVO em mínimo (24h). Vazio = "Tudo em dia 🤝".
   - **Bloco F.2.3** (`ac5c6c4`) — **"Produtos que tão bombando"**
     (substitui "Top 3 por lucro absoluto"). Critério: aceleração 30%+
     vs média móvel 28d. Fallback Top 3 lucro absoluto quando loja jovem.
     Esconde se sem candidato (zero ruído).
   - **Bloco F.2.4 + F.2.5** (`9a9459e`) — **KPIs tabulares** (1 linha
     densa de 4 KPIs secundários, devoluções com semântica invertida) +
     **Mini-snapshot loja online** (recados pendentes · produtos sem foto ·
     count publicados · link vitre.site/slug).

   **NÃO entrou na v1 (decisão consciente do conselho)**:
   - 3 atalhos gigantes sticky: gasta 60px em mobile pra economizar 1
     clique. Mantemos só "Nova venda" no header.
   - Alerta de margem negativa banner topo: cry-wolf alto. Mover pro
     drawer da venda em commit futuro (contexto > alerta global).

**Visível pro cliente**: SIM (dashboard novo). Layout final top-to-bottom:
Header → Hero Lucro → KPIs tabulares → (Pegando fogo · Bombando 2-col) →
Charts → Vendas recentes → Mini loja online.

### 🔀 Semana 4 — Separação gestão ≠ catálogo público

**Entregáveis:**

1. **Refundação do form de produto** (`product-form.tsx` + tabs):
   - Aba "Identidade": nome, marca, categoria, código interno, GTIN, NCM, peso, unidade
   - Aba "Preço & Custo": cost_price, base_price, wholesale_price, promo_*, **installments_override** (movido), **cash_discount_override** (movido), commission_bps
   - Aba "Estoque": track_stock, min/max stock, allow_oversell, batch_tracking
   - Aba "Variantes": tabela de SKUs com cost variant-aware
   - Aba "Loja online" (renomeada "Catálogo público"): is_published, is_featured, slug, description, meta_*, composition/modeling/lining/washing, imagens HD
   - **Tooltip claro em "Preço & Custo"**: "Estes preços valem em TODOS os canais (PDV, WhatsApp, loja online)"

2. **Nova rota `/admin/itens`** (gestão pura):
   - Lista filtrada `product.kind = raw_material`
   - Form simplificado: nome + custo + estoque + categoria
   - Não exige preço de venda, não permite publicar loja online
   - Aparece em estoque (capital empatado) e relatórios (patrimônio)

3. **Refactor coluna STATUS em `products-table.tsx`**:
   - Hoje: badge "Publicado na loja" + "Ativo" misturados
   - Depois: 2 colunas separadas — "Tipo" (item / produto / catálogo) + "Status" (ativo / pausado)

4. **Remoção dos 6 KILL**:
   - Deletar `/admin/assinatura/page.tsx`, `/admin/equipe/page.tsx`
   - Deletar 4 rotas legacy (clientes/novo, clientes/[id], produtos/novo, produtos/[id])
   - Remover `ImportCsvStubButton` (régua "funciona ou esconde")
   - Remover aviso amarelo de `/admin/atributos` (decidir: completar ou esconder do menu)

**Visível pro cliente**: SIM (clareza no cadastro).

### 📄 Semana 5 — Orçamento + Polimento + ETL

**Entregáveis:**

1. **`/admin/orcamentos`** (nova rota):
   - CRUD de orçamentos (nome cliente, itens, valor total, validade, observações)
   - PDF imprimível com CNPJ + endereço + telefone + logo + itens + total + validade + termos
   - SEM conversão automática pra venda — vendedor cria venda separada se cliente aceitar
   - Status: rascunho / enviado / aceito / recusado / expirado

2. **Polimento visual** (telas de gestão apenas):
   - Densificar `metric-card.tsx`, `op-card.tsx` (gap-2 → gap-1, paddings menores, fonte 14px tabular)
   - Remover `backdrop-blur` em telas de gestão (manter no modal PDV pra foco)
   - Empty states: substituir ilustração grande por chamada-pra-ação direta + atalho
   - Padronizar 1 atalho "+ Nova venda" sticky no admin shell (visível em qualquer página)

3. **Script ETL `scripts/etl-migration-v2.mjs`** (se founder confirmar — alternativa: reconstrução manual):
   - Lê dados dos 3 clientes pagantes (vendas, produtos, clientes, estoque, fiado, despesa, caixa, compra)
   - Preserva snapshots históricos
   - Aplica novo schema (kind, snapshots de fee/commission/interest)
   - Backfill de snapshots faltantes a partir de `store.card_real_fee_bps_*` contemporâneo
   - Dry-run + apply com confirmação

4. **Limpeza de pendências de parcialidade**:
   - `audit_event`: criar tela `/admin/auditoria` com listagem filtrada (LGPD compliance + detecção de fraude)
   - `product_related`: CRUD admin em aba do produto (substitui fallback automático)

**Visível pro cliente**: SIM (entrega final + migração).

---

## 5. Régua anti-bola-de-neve

- ❌ Auditar 100% das telas em paralelo — foco nas 4 áreas-chave (Vendas, Estoque, Produtos, Loja online) cruzadas com as 7 perguntas.
- ❌ Mudar sidebar de 4 grupos — estrutura tá certa, o que muda é PESO VISUAL.
- ❌ Refazer storefront — fora do escopo. Loja online ganha integração mais limpa, não refundação.
- ❌ Adicionar feature que não responda 1 das 7 perguntas-mãe — fim do scope creep.
- ❌ Migrar pra novo banco sem ETL — sempre preservar histórico dos 3 clientes pagantes.
- ❌ Decorar dashboard com gradient/glassmorphism — denso, número grande, vocabulário de varejista BR.
- ❌ Implementar `kind` enum sem migration backward-compatible — todas as alterações em `product` precisam de `DEFAULT 'finished_good'` pra não quebrar 3 lojistas em produção.

---

## 6. Como aplicar (em toda decisão futura)

**Antes de criar/refazer qualquer tela do admin, perguntar:**

1. Qual das 7 perguntas-mãe essa tela serve? Se nenhuma → repensar ou matar.
2. É tela de gestão pura, comercializável ou catálogo público? Se "ambos" → separar UI por intenção.
3. Os números mostrados vêm do helper canônico `calculateNetProfit`? Se não → bug latente.
4. Tem snapshot histórico íntegro pra comparação com período anterior? Se não → relatório vai mentir em 6 meses.
5. Vocabulário tá no PT-BR varejista? Se tem "Cliente Final", "Métricas", "Analytics" → reescrever.
6. Tem decoração SaaS-US (gradient, glassmorphism, ilustração grande) em tela de gestão? Se sim → remover.
7. Tem botão "em breve" / disabled / stub visível? Se sim → esconder até funcionar (régua "funciona ou esconde").

---

## 7. Pendências de decisão do founder

Pontos que o conselho identificou como **decisão do founder, não do dev**:

| # | Pendência | Recomendação do conselho | Bloqueia? |
|---|---|---|---|
| 1 | **ETL vs reconstrução manual** dos 3 clientes pagantes pro schema novo | ETL — preserva histórico de vendas (= ativo do lojista) | Semana 5 |
| 2 | **`/admin/atributos`** — completar integração storefront ou esconder? | Esconder do menu (já está oculto) E remover aviso amarelo da tela. Reativar com PP6.x se necessário. | Semana 4 |
| 3 | **`product_related` UI** — implementar curadoria admin ou manter só fallback automático? | Implementar UI admin (schema pronto, é UI rápida) | Semana 5 |
| 4 | **`audit_event` UI** — criar `/admin/auditoria` ou deixar só pra DBA? | Criar tela com filtros básicos (LGPD + transparência) | Semana 5 |
| 5 | **Stubs visíveis** (`ImportCsvStubButton`, aviso amarelo atributos) | Remover JÁ — viola régua "funciona ou esconde" | Semana 4 (ou antes) |
| 6 | **Analytics da loja online** (pergunta-mãe #7 score 3/10) | Plug Plausible/GA + tela `/admin/loja/analytics` — escopo NOVO, fora das 5 semanas | Fora do escopo atual |

---

## 8. Apêndice — relatórios brutos da auditoria

Os 3 relatórios completos dos agentes que alimentaram esta síntese estão arquivados em:

- Mapa de telas (47 page.tsx) — agente 1
- Mapa de entidades (34 tabelas) — agente 2
- Mapa de gaps gestão × loja online — agente 3

Disponíveis nos transcripts da sessão de 2026-05-27.

---

**Última atualização**: 2026-05-28 — Semana 3 (Lucro no centro) fechada via
Bloco F.2 curado pelo conselho (Hero honesto + Pegando fogo DELTA +
Produtos bombando + KPIs tabulares + Mini loja online).
**Próxima ação**: Semana 4 — Separação gestão ≠ catálogo público (form
de produto refundado + nova rota `/admin/itens` pra gestão pura).
