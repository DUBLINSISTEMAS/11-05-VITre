# Auditoria visual Lote 3 — Ondas 0-6 vs canvas-v1

Data: 2026-05-10
Escopo: 4 telas admin (Dashboard, Catálogo, Editar produto, Pedido detalhe) + shell compartilhado.
Canvas fonte: `canvas-extracted-tmp/_vitre-admin.jsx` (737 linhas).
Implementação: ~12 componentes em `src/components/admin/**` + 4 pages.

---

## Resumo executivo

| Tela | Score | Justificativa |
|---|---|---|
| Dashboard | **6.5/10** | StatCards e SetupChecklist fiéis; chart simplificado demais (40px viewBox vs 200px canvas); falta tabela densa de pedidos com grid mono — ficou em lista de cards com avatar colorido inexistente no canvas. |
| Catálogo | **7.5/10** | Tabela densa + tabs + filtros bem mapeados; perdeu a barra de filtros mono dropdown (Categoria/Coleção/Preço) substituída por Select shadcn padrão; faltam contadores por aba ("Todos · 8") e a coluna "ESTOQUE" em mono uppercase headers tem proporção de coluna distinta. |
| Editar produto | **5.5/10** | Estrutura 1.5fr/1fr respeitada e Cards equivalentes existem; **divergência grande** — substituiu Pillset (canvas linhas 712-733) por VariantEditor próprio (componente preservado fora do escopo); media uploader não tem aspect-ratio 3/4 com badge "CAPA" mostrado como sobreposição como no canvas (linha 451); Pillset/Pills inline `Tamanhos × Cores` ausentes. |
| Pedido detalhe | **6/10** | Timeline bem implementada (semântica de `done/current/pending` correta com ring brand-tint); mas inversão de hierarquia visual — canvas tem timeline na coluna esquerda principal (1.5fr) e cliente/sidebar na direita; impl tem cliente+itens+conversa esquerda e timeline+ações na direita. Snippet WhatsApp ficou genérico (placeholder explicativo) em vez do balão `bg-success-soft` colado da última msg. |
| **Shell** | **8/10** | Sidebar 232px ✅, StoreSwitcher ✅, StorefrontFooterCard ✅, AdminPageHeader ✅. Decoração do tile do ícone (gradient + ring + shadow-brand-sm) é **elaboração além do canvas** — canvas é flat (linhas 41-64). Não é gap, é um upgrade — mas vale registrar como divergência intencional. |

**Score global estimado: 67/100 — fidelidade arquitetural alta, fidelidade visual média.**

### Top 5 divergências de maior impacto (ordem prioridade Onda 7)

1. **[GAP] Tabela "Pedidos recentes" do dashboard virou lista-cards com avatar colorido.** Canvas (linhas 252-277) é grid 6 colunas (`110px 1.4fr 70px 1fr 130px 80px`) com ID monospace, dot+status texto, `há X min` mono à direita. Implementação (`recent-orders-table.tsx`) renderiza pílula `bg-primary/10` redonda com shortCode + nome + total + OrderStatusBadge + seta — visualmente é um Link list, não DataGrid. Custo: médio. Impacto: alto (é a "voz" do dashboard).

2. **[GAP] RevenueChart muito miniaturizado.** Canvas usa SVG `viewBox 0 0 600 200` com altura 180px, grid de linhas dashed em y=20/70/120/170, badge `R$ 1.240 · ter` posicionado **acima** do último ponto, e labels de datas mono no rodapé (`25/03 · 27 · 29 · ...`). Implementação usa `viewBox 0 0 100 40`, altura `h-32` (128px), sem gridlines, sem labels de datas no eixo X. Tickle de "vt-display" e `R$ 9.812` hero number canvas (linha 161, fontSize 22) virou `text-base` (16px). Custo: médio. Impacto: alto — é o card mais carro-chefe da home.

3. **[GAP] Editar produto perdeu Pillset de variantes (Tamanhos/Cores) e media tiles aspect-ratio 3/4 com badge "CAPA".** Canvas (linhas 449-461 + 466-468) mostra: 5 thumbnails 3:4 com 1 marcado "CAPA" + 1 tile dashed "Adicionar"; e Pillset com chips `PP P M G GG` e `Cru Preto Terracota Sálvia` cada um com `×` pra remover + botão dashed `+ Adicionar`. Implementação delega tudo a `ImageUploader` e `VariantEditor` que têm semântica diferente (variants tabulares com axis/preço/estoque por linha). É preservação UX consciente, mas o **visual** do canvas se perdeu — cards parecem um form genérico. Custo: alto pra portar Pillset; alto pra refazer ImageUploader com badge CAPA. Impacto: médio (tela menos vista que home/lista). **Recomendação: dívida futura**, exceto badge "CAPA" que custa ~10min e é fiel.

4. **[GAP] Inversão de coluna no pedido detalhe.** Canvas (linha 558): `gridTemplateColumns: '1.5fr 1fr'` com **timeline + itens** na esquerda larga e **cliente + última mensagem** na direita estreita. Impl inverteu: cliente+itens+conversa na esquerda, timeline+ações na direita. Funcional ok, mas hierarquia visual da Sandra é "ver progresso → ver itens" canvas, agora é "ver cliente → ver progresso". Custo: baixo (swap de colunas). Impacto: médio.

5. **[SUTIL] StatCards perderam o eyebrow letter-spacing 0.4 e o gap interno do canvas.** Canvas (linhas 138-150): `padding 16` + 6px gap entre eyebrow→hero + 8px gap entre hero→delta+hint, eyebrow `letterSpacing: 0.4`. Implementação aplica `text-eyebrow` (utility `letter-spacing: 0.04em` ≈ 0.4px em 10px), `gap-3`, `p-4`. Tracking ok, gaps levemente maiores. **Verificado: `text-eyebrow` no globals.css implementa o spec corretamente.** Apenas gaps são levemente maiores que canvas. Custo: trivial. Impacto: baixo.

---

## Por tela

### Dashboard

#### Score: 6.5/10

#### Aderências (o que ficou fiel)

- StatCard renderiza eyebrow → hero number → delta+hint na ordem certa (`stat-card.tsx` linhas 19-32 vs canvas 134-150).
- `text-eyebrow` utility aplicada (mono 10px, letter-spacing 0.04em, color gray-500) — fidelidade total ao canvas (linha 139).
- `text-hero-num` utility (28px, font-weight 600, tracking -0.0214em, tabular-nums) — fidelidade ao canvas (linha 140 `fontSize: 28, fontWeight: 600, letterSpacing: -0.6` ≈ -0.021em).
- DeltaChip com 3 tons (positive/negative/neutral) usando `bg-success-soft` / `bg-destructive-soft` / `bg-muted` — match com canvas (linhas 144-147).
- SetupChecklist (`setup-checklist.tsx`) pega 6 itens, progress bar, checkmark em done, line-through — fidelidade alta com canvas (linhas 209-238).
- Background `bg-brand-tint` no SetupChecklist replica canvas (linha 209 `var(--vt-brand-tint)`).

#### Divergências

- **[GAP] RevenueChart simplificado.** `revenue-chart.tsx` linha 92-93: `width: 100, height: 40`. Canvas (linha 175-176): `viewBox: 0 0 600 200, height: 180`. Sem gridlines dashed (canvas linhas 184-186). Sem labels de datas no eixo X (canvas linhas 201-205 — `25/03 27 29 31 02/04 04 06`). Hero number do total ficou `text-base` (16px) em vez de canvas `fontSize: 22, vt-display, vt-num` (linha 161). Sugestão fix: aumentar viewBox pra ~600/200, adicionar 4 linhas dashed via `<line stroke-dasharray="3 4">`, adicionar `<g>` de tspan labels mono no rodapé com `Math.floor(period / 7)` ticks.

- **[GAP] Tabela "Pedidos recentes" virou lista-cards.** `recent-orders-table.tsx` linha 52: `grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto]` com pílula `bg-primary/10 size-9 rounded-md` mostrando shortCode. Canvas (linhas 252-277): grid `110px 1.4fr 70px 1fr 130px 80px` com 6 colunas (PEDIDO mono · CLIENTE · ITENS · TOTAL · STATUS dot+texto · QUANDO mono). Não há avatar/pill colorido — é texto monospace no canvas. Sugestão fix: substituir por `<table>` ou grid 6-col com headers mono uppercase (estilo do que `products-table.tsx` faz na linha 80 — copiar essa pattern).

- **[SUTIL] Header com action "Compartilhar loja" + "Novo produto" do canvas (linhas 124-127) virou apenas WelcomeCard.** Canvas (linha 121) tem título "Olá, Sandra 👋" + subtitle data localizada + 2 botões CTA. Impl tem `AdminPageHeader title="Painel" subtitle="Olá, X"` + WelcomeCard separado. Custo: baixo. Impacto: baixo (decisão UX consciente).

- **[SUTIL] Stat cards mostram `+12%` mas canvas usa "+12% vs. semana anterior"** com hint cinza ao lado (canvas linha 148). Impl tem `hint="vs 7 dias anteriores"` — match em copy mas hint fica em linha separada do delta em vez de inline (canvas é flex inline). Local: `stat-card.tsx` linha 24 (`flex flex-wrap items-center gap-2`). Diff é mínimo se chip+hint cabem em 1 linha; em mobile `flex-wrap` quebra em 2 linhas — aceitável.

- **[IGNORAR] DashboardQuickActions inline no mobile.** Decisão fechada (canvas é desktop-only).

---

### Catálogo (lista de produtos)

#### Score: 7.5/10

#### Aderências (o que ficou fiel)

- Tabela densa desktop com header monospace uppercase (`products-table.tsx` linha 80: `text-eyebrow bg-muted/50 grid grid-cols-[40px_64px_minmax(0,1.6fr)_100px_minmax(0,1fr)_100px_88px_40px]`). Canvas (linha 345): `gridTemplateColumns: '40px 80px 1.6fr 90px 1fr 90px 80px 40px'`. **Proporções muito próximas** — diff é apenas 80→64 na foto e 90→100 em SKU/Estoque. Custo de alinhar: trivial.
- Status pills com dot 1.5px + texto: visíveis (success-soft), pausados (muted), sem estoque (destructive-soft), rascunho (muted). Match com canvas (linhas 376-382).
- Estoque com cor condicional (out=destructive, low<5=warning, normal=foreground): canvas linha 374, impl `products-table.tsx` linha 287 — match parcial (impl não trata "low<5", apenas out=destructive ou foreground).
- ProductsStatusTabs (5 tabs) com pílula ativa `bg-foreground text-background`: canvas linhas 314-321 (4 tabs com pattern idêntico). Decisão "Pausados" extra está no escopo fechado.

#### Divergências

- **[GAP] Filtros perderam estilo mono dropdown.** Canvas (linhas 324-333): 3 botões `Categoria · Coleção · Preço` com altura 28, padding `0 10`, mono-ish, com chevron 12×12. Sortby separado à direita com label mono "ORDENAR" + botão `Mais recentes ⌄`. Impl (`products-filters.tsx`): `<Select>` shadcn padrão (h-9, padding maior, sem chevron customizado) + sem "ORDENAR" label, sem Coleção, sem Preço. Sugestão fix: manter shadcn Select (decisão consciente — `coleções` não existe no schema), mas aplicar visual mono no trigger (`text-[11.5px] font-mono`) e adicionar label "ORDENAR" mono uppercase à esquerda do select.

- **[GAP] Falta contador inline nas tabs.** Canvas (linha 314): `'Todos · 8', 'Ativos · 7', 'Rascunhos · 1', 'Sem estoque · 1'` — cada label inclui count. Impl (`products-status-tabs.tsx` linha 14-20): apenas `Todos / Visíveis / Pausados / Rascunhos / Sem estoque`. Sugestão fix: passar contadores como prop do server (já calculados ou consulta paralela com `count` agrupado por status) e renderizar `{tab.label} · {count}` quando >0.

- **[GAP] Busca canvas tem `⌘K` indicator + ícone search dentro do input com border próprio (linha 301-305).** Impl tem `<kbd>⌘K</kbd>` mas só visível em sm+ (`hidden sm:inline-block`) — match parcial. Visual do input shadcn `<Input>` não tem o mesmo "border 1px + height 36 + padding 0 12" do canvas — é o input shadcn padrão. Custo: trivial. Impacto: baixo.

- **[SUTIL] Foto column 64px vs canvas 80px.** `products-table.tsx` linha 80 e 109: `grid-cols-[...64px...]`. Canvas linha 345: `80px`. Imagem dentro é `size-12` (48px) impl vs `width: 56, height: 56` canvas (linha 362). Custo: trivial (mudar 64→80 + size-12→size-14). Impacto: estético médio (linhas ficam um pouco mais respirantes).

- **[SUTIL] Faltam linhas zebra/divider sutis.** Canvas linha 359: `borderBottom: i < products.length - 1 ? '1px solid var(--vt-border)'`. Impl linha 98: `<ul role="rowgroup" className="divide-y">`. **Match em comportamento**, ok.

- **[SUTIL] Subtítulo da linha "Vestidos · 4 variantes · 12 fotos"** existe no canvas (linha 365) abaixo do nome. Impl não tem (apenas nome trunc). Custo: médio (precisa fetch de variants count + images count). Impacto: baixo.

- **[IGNORAR] Tab "Pausados" extra.** Decisão fechada.

---

### Editar produto

#### Score: 5.5/10

#### Aderências (o que ficou fiel)

- Grid 1.5fr/1fr (`product-form.tsx` linha 202: `grid gap-4 lg:grid-cols-3 lg:items-start` com `lg:col-span-2` esquerda e `lg:col-span-1` sticky direita). Canvas (linha 438): `gridTemplateColumns: '1.5fr 1fr'`. **Proporção idêntica** (2/3 vs 1/3 ≈ 1.5fr/1fr).
- Coluna direita sticky (`lg:sticky lg:top-4`) — match canvas linha 499 (`position: 'sticky', top: 0`).
- Card `Status` com toggles label+hint+switch — Toggle equivalente em ToggleRow (`product-form.tsx` linha 612). Match parcial: canvas tem 3 toggles (Publicado / Em destaque / Permite venda sem estoque), impl tem 2 (Em destaque + StockInput composto).
- Card `Organização` (Categoria + Tags + Coleção) → impl tem só Categoria+CategoryDialog inline. Slug e Tags fora do escopo do schema.
- Header com `← Catálogo` breadcrumb-like via subtitle do AdminPageHeader. Canvas (linhas 410-417) tem breadcrumb dedicado `<div padding=14px24px borderBottom>`. Impl mais simples mas funcional.

#### Divergências

- **[GAP] Pillset ausente.** Canvas (linhas 712-733) renderiza `Tamanhos: PP P M G GG ×` + `Cores: Cru Preto Terracota Sálvia ×` com chips `vt-50` border + `× Adicionar` dashed. Impl tem `VariantEditor` (componente preservado canvas 0-6) que renderiza variantes em formato tabular linha-por-linha (axis/preço/estoque/sku/colorHex). Visual completamente diferente. Custo: alto (refazer fluxo de variantes). Impacto: médio. **Recomendação: dívida futura — VariantEditor é mais funcional que Pillset; dois mundos diferentes.**

- **[GAP] Mídia sem badge "CAPA" + sem aspect-ratio 3/4.** Canvas (linha 451): `<VTImg cap={i === 0 ? 'CAPA' : null} ratio="3/4" style={{ borderRadius: 8, border: '1px solid var(--vt-border)' }} />`. Impl `ImageUploader` renderiza thumbs sem badge "CAPA" sobreposta no primeiro item, e provavelmente em ratio 1/1 (não verificado mas é o pattern shadcn padrão). Sugestão fix: adicionar `<span class="absolute top-1 left-1 text-eyebrow bg-foreground text-background px-1.5 py-0.5 rounded">CAPA</span>` no primeiro thumb + ajustar aspect-ratio pra 3/4. Custo: baixo. Impacto: médio (Sandra reconhece imediatamente "qual é a capa").

- **[GAP] Card Preço sem "Margem com promo".** Canvas (linhas 509-516) tem caixa verde com Margem calculada. Impl não tem (e nem teria — Sandra não cadastra custo). **Decisão fechada.** [IGNORAR]

- **[GAP] Card Preço sem campo "Custo por item (privado)".** Canvas linha 508. **Decisão fechada — Sandra não cadastra custo.** [IGNORAR]

- **[GAP] Tabela de variantes (canvas linhas 470-494) com 5 colunas mono uppercase (VARIANTE/SKU/PREÇO/ESTOQUE/PESO) substituída pelo VariantEditor.** Canvas é display table em readonly-style; impl é editor live. Diff arquitetural justificado. [IGNORAR]

- **[GAP] Header da tela perdeu actions canvas.** Canvas (linhas 430-435): `Visualizar / Despublicar (vermelho) / Salvar alterações (preto)`. Impl: `ProductPublishToggle + DropdownMenu(Excluir)`. Save migrou pro footer/sidebar mobile/desktop. Funcional mas hierarquia diferente. Custo: médio. Impacto: baixo (UX impl é melhor — sticky save é mais visível).

- **[GAP] Status pill no header canvas (linhas 421-428).** `dot success + Publicado · Atualizado há 2 horas`. Impl: ProductPublishToggle (Switch) na barra de actions. Funcional, mas tira a leitura "publicado/há 2h" instantânea do canvas. Sugestão fix: subtitle do AdminPageHeader poderia incluir status dot + tempo (`<span class="size-1.5 rounded-full bg-success" /> Publicado · há 2h`). Custo: baixo. Impacto: baixo.

- **[SUTIL] Cards meta "Detalhes" (Composição/Modelagem/Forro/Lavagem) não existem no canvas.** É elaboração além — provavelmente decisão consciente da Onda 6. Não é divergência. [IGNORAR]

- **[SUTIL] FormCard padding `p-4 sm:p-5`. Canvas Card (linhas 652-664): `padding: 18`.** Diff de 2-4px. Custo: trivial. Impacto: nulo.

---

### Pedido detalhe

#### Score: 6/10

#### Aderências (o que ficou fiel)

- OrderTimeline com 6 etapas, ring brand-tint no current, bg-foreground no done, border foreground/30 no pending — match canvas (linhas 562-589).
- Connector vertical entre bolinhas (`absolute left-[11px] top-6 bottom-0 w-px`) — fidelidade ao canvas linha 580 (`width: 1.5, flex: 1, background: vt-fg/vt-border`).
- Cliente card com avatar redondo + nome + telefone mono — match canvas (linhas 624-630). Impl não tem avatar com inicial (só ícone PhoneIcon), mas estrutura similar.
- Endereço em `bg-muted/50 rounded-lg p-3` — match canvas (linha 631 `bg-vt-50 borderRadius=8`).

#### Divergências

- **[GAP] Inversão das colunas.** Canvas linha 558: `1.5fr 1fr` com **timeline+itens à esquerda** e **cliente+última msg à direita**. Impl linha 103: `lg:grid-cols-3` com **cliente+itens+WhatsApp à esquerda (col-span-2)** e **timeline+ações à direita (col-span-1)**. Hierarquia visual diferente. Sugestão fix: trocar `col-span-2` ↔ `col-span-1` entre os dois divs (linhas 105 e 222). Custo: trivial. Impacto: médio.

- **[GAP] Snippet WhatsApp virou placeholder estático.** Canvas (linhas 637-643): balão `bg-vt-success-soft` colado da última msg literal: `"Oi Sandra! Pode mandar no Pix? Pago hoje à noite ❤️"` + botão WhatsApp verde abaixo. Impl (`pedidos/[id]/page.tsx` linhas 195-218): card `bg-card` com `<p>Histórico fica no aplicativo WhatsApp da loja...</p>` + botão outline. Visualmente é um info-box, não a "voz do cliente". **Decisão fechada — admin não tem histórico** [IGNORAR]. Mas o tratamento visual poderia ainda ser uma quote stylizada (`bg-success-soft p-3 rounded-lg italic text-muted-foreground`) com texto fixo tipo "A Sandra responde direto pelo WhatsApp — abra a conversa pra ver." pra ficar mais próximo do canvas.

- **[GAP] Header sem botão "Imprimir" canvas (linha 553).** Impl tem só OrderStatusBadge. Imprimir é fluxo válido (etiqueta de envio) mas não está implementado. Custo: alto (precisa de print stylesheet). Impacto: baixo. **Recomendação: dívida futura.**

- **[GAP] Itens card faltando linha "Frete: a combinar" + "Desconto: −R$ 0,00" no canvas (linhas 605-613).** Impl tem só Total. Canvas tem Subtotal/Frete/Desconto/Total empilhados com `vt-num` e separadores. Custo: baixo (apenas markup; valores são estáticos no canvas). Impacto: baixo (Sandra não usa frete em catálogo via WhatsApp — fica negociado fora).

- **[GAP] Card "Cliente" não tem avatar com iniciais coloridas + "3º pedido · cliente desde mar/26".** Canvas linhas 624-635. Impl tem PhoneIcon + telefone + observações. Custo: médio (precisa de query agregada — quantos pedidos esse cliente já fez). Impacto: baixo.

- **[SUTIL] Ações/transições de status (`OrderStatusActions`) não existem no canvas — é elaboração além.** Não é divergência (canvas é display-only mockup).

- **[IGNORAR] Card "Última mensagem" placeholder.** Decisão fechada.

---

## Padrões transversais

Drifts que aparecem em mais de uma tela:

1. **Section cards com `text-[13.5px] font-semibold tracking-tight` no h2.** Canvas Card (linha 659): `fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2`. Impl usa exatamente `text-[13.5px] font-semibold tracking-tight` em todos os Cards. **Match perfeito.** ✅

2. **Padding interno de Cards.** Canvas: `padding: 18` (linha 656). Impl: `p-4 sm:p-5` (16-20px). Drift de ±2-4px presente em todos os Cards. Trivial.

3. **Border radius das cards.** Canvas: `borderRadius: 12`. Impl: `rounded-xl` que é 0.75rem = 12px com `--radius: 0.65rem` resolvendo `--radius-xl` ≈ 14px. **Próximo, drift mínimo.**

4. **Mono number em valores monetários.** Impl é consistente: `font-mono tabular-nums` em todos os preços/totais. ✅ Match canvas (`vt-num` em todo lugar).

5. **Eyebrow letter-spacing.** `--text-eyebrow` no globals.css linha 287: `letter-spacing: 0.04em`. Canvas: `letterSpacing: 0.4`. Em 10px isso é 0.4px → 0.04em. **Match perfeito** ✅

6. **Sidebar tile do ícone (gradient + ring + shadow-brand-sm) é elaboração além do canvas.** Canvas linha 53: `<span style={{ display: 'inline-flex', color: 'currentColor' }}>{n.icon}</span>` — flat, sem tile. Impl `admin-sidebar.tsx` linha 65-71: gradient + ring + sombra. **Não é gap; é upgrade Fly.io intencional documentado em CLAUDE.md.** [IGNORAR]

7. **Hover `hocus:` consistente em todos os links navegáveis.** Match canvas semantics (canvas não tem estados de hover renderizados, mas é display mockup — é responsabilidade da impl preencher esses estados).

---

## Tokens drift

Mapeamento `--vt-*` (canvas) → tokens Vitrê:

| Canvas | Mapeamento esperado | Onde a impl resolve | Status |
|---|---|---|---|
| `--vt-bg` | `--card` (branco puro) | `bg-card` | ✅ |
| `--vt-fg` | `--foreground` (carvão) | `text-foreground` / `bg-foreground` | ✅ |
| `--vt-50` | `--gray-50` ou `--muted` | `bg-muted` / `bg-muted/50` | ✅ (próximo) |
| `--vt-300` | `--gray-300` | `border-foreground/30` em alguns lugares | ⚠️ **drift sutil** — alguns componentes usam `border-foreground/30` (canvas: hover/disabled border), outros usam `border-input` (`--gray-200`). Inconsistente entre OrderTimeline e SetupChecklist. |
| `--vt-400` | `--gray-400` (`--muted-foreground` mais claro) | `text-muted-foreground/60` em alguns | ⚠️ drift sutil — canvas linha 203 `--vt-400` deveria mapear pra um token nomeado, não opacity arbitrária. |
| `--vt-500` | `--muted-foreground` (`--gray-500`) | `text-muted-foreground` | ✅ |
| `--vt-600` | `--gray-600` | usado em `text-foreground/80` ou similar | ⚠️ drift — canvas linha 670 `vt-600` deveria ter token; impl usa opacity. |
| `--vt-700` | `--gray-700` | similar | ⚠️ |
| `--vt-border` | `--border` (`--gray-200`) | `border-border` (default) | ✅ |
| `--vt-brand` | `--primary` (carvão) | `text-primary` / `bg-primary` | ✅ |
| `--vt-brand-tint` | `--brand-tint` (mix 8% white) | `bg-brand-tint` | ✅ |
| `--vt-success` | `--success` (verde 0.60 0.17 150) | `text-success` / `bg-success` | ✅ |
| `--vt-success-soft` | `--success-soft` (12% white mix) | `bg-success-soft` | ✅ |
| `--vt-warning` | `--warning` (amarelo 0.78 0.15 80) | `text-warning` | ✅ |
| `--vt-destructive` | `--destructive` | `text-destructive` | ✅ |
| `--vt-destructive-soft` | `--destructive-soft` | `bg-destructive-soft` | ✅ |
| `--vt-wa` | `--whatsapp` (verde 0.71 0.21 145) | `bg-whatsapp` | ✅ |
| `--vt-shadow-sm` | `--shadow-sm` (oklch 0.17 0.015 260 / 0.04) | `shadow-sm` | ✅ |

**Conclusão tokens:** mapeamento canvas → Vitrê está **95% correto**. Único drift real é nos tons intermediários `--vt-300/400/600/700` que não têm aliases dedicados e foram resolvidos via `text-muted-foreground/N` ou `text-foreground/N` opacity inconsistente. Sugestão: criar utilities `text-gray-{300,400,600,700}` (já estão no `@theme` como `--color-gray-N`) e usar `text-gray-400` em vez de `text-muted-foreground/60`.

---

## Conclusão

### Fidelidade global: ~67%

- **Arquitetural (estrutura grid, sticky, responsive)**: 85%
- **Tokens (cores, sombras, raios)**: 95%
- **Tipografia (eyebrow, hero-num, mono em números)**: 90%
- **Componentes (StatCard, Toggle, Timeline)**: 80%
- **Visual densidade (DataGrid, Pillset, badges)**: 50%
- **Padrões interação (hover, focus, current)**: 90%

### Recomendação Onda 7

**Fix AGORA (custo baixo, impacto alto):**

1. **Inverter colunas do pedido detalhe** (`pedidos/[id]/page.tsx` linhas 105 e 222: trocar `col-span-2` ↔ `col-span-1`). Custo trivial. Impacto médio.
2. **Adicionar contadores nas tabs do catálogo** (`products-status-tabs.tsx` + server query agrupado). Custo baixo. Impacto médio.
3. **Reescrever RecentOrdersTable como DataGrid** (canvas linhas 252-277). Copiar pattern do `products-table.tsx` linhas 78-96. Custo médio. Impacto alto.
4. **Adicionar badge "CAPA" no primeiro tile do ImageUploader** + aspect-ratio 3/4 nos thumbs. Custo baixo. Impacto médio.
5. **Adicionar gridlines + labels mono no eixo X do RevenueChart** + aumentar viewBox/altura pra 600×200. Custo médio. Impacto alto.

**Dívida futura (custo alto, impacto médio-baixo):**

- Reescrever VariantEditor como Pillset (provavelmente não vale — VariantEditor é mais funcional).
- Adicionar Imprimir no pedido (precisa de print stylesheet).
- Avatar com iniciais coloridas no Cliente card + "3º pedido".
- Linha "Vestidos · 4 variantes · 12 fotos" no subtítulo de cada produto da tabela.
- Centralizar drift de `--vt-300/400/600/700` em utilities `text-gray-N`.

**Não consertar (decisão consciente / fora de escopo):**

- Margem com promo (Sandra não tem custo).
- 5ª tab "Pausados" (UX preservation).
- Tile do ícone com gradient na sidebar (upgrade Fly.io).
- Snippet WhatsApp como balão da última msg (impl não tem histórico).

**Nota final:** o trabalho fez o **mais difícil** (estrutura grid, sticky, tokens, eyebrow/hero-num utilities, sidebar 232px, AdminPageHeader, OrderTimeline com states corretos) e ficou devendo o **mais visual** (densidade tabular, badges em mídia, balão de mensagem, gridlines no chart). A correção da Onda 7 deve focar no item 3 (RecentOrdersTable) e item 5 (RevenueChart) — são os elementos do dashboard que **vendem o produto** e estão hoje aquém do canvas.
