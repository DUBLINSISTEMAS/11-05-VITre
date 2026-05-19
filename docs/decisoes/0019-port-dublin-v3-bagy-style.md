# ADR-0019: Port "Dublin v3 (BAGY-style)" — refresh visual completo

- **Data**: 2026-05-17
- **Status**: **parcialmente entregue → PARKED** (atualizado 2026-05-19). Ondas 0-5i fechadas em prod (tokens + sidebar 248px + login split + onboarding 4-passos). High-fidelity 44 telas + módulos novos **suspensos** após conselho-5-agentes diagnosticar que o feedback dos prospects ("amador") era gap funcional, não cosmético. Ver [ADR-0034](./0034-camada-comercial-vitre.md).
- **Suspenso por**: [ADR-0034 Camada Comercial Vitrê](./0034-camada-comercial-vitre.md)
- **Substitui parcialmente**: [ADR-0007](./0007-identidade-visual-vitre.md) (paleta primary `#1E3FE6` → navy `#1A3A8F`); [ADR-0009](./0009-design-system-tokens-navy.md) (tokens base `--brand` + utilities + sombras)
- **Convive com**: [ADR-0010 redesign canvas-v1](./0010-redesign-canvas-v1.md) (canvas-v1 era a base anterior; Dublin v3 Ondas 0-5i é o próximo estágio entregue), [ADR-0011](./0011-brand-color-restrita-bottom-nav-sacola.md) (escopo `--brand-store` preservado)

## Atualização 2026-05-19 — PARKED

Após feedback de prospects vendo demo + screenshots GFIL trazidos pra sessão (`PAINEL REF/`), conselho-5-agentes diagnosticou que o veredito "amador" é **gap funcional arquitetônico** (sem custo, margem, GTIN, vendedor, pagamento dividido, fiado), não cosmético. Polir 44 telas pixel-perfect sem ter dado-fonte é fazer trabalho que precisa ser refeito quando dado-fonte chegar.

**Trabalho entregue (Ondas 0-5i) permanece em prod** — é base suficiente pra Camada Comercial ser construída em cima. **Trabalho parked**: high-fidelity pixel-perfect 44 telas + módulos UI novos (Atributos / Cupons / Grupos / Equipe — backends JÁ implementados sob 0024/0026/0025/0029, falta apenas UI pixel-perfect dos painéis correspondentes).

**Gatilho pra retomar** (mesma régua do ADR-0033 fiscal): ≥5 clientes pagantes ativos pedirem refresh visual como bloqueador de uso. Até lá, foco é Camada Comercial (ADR-0034).

## Contexto

Em 2026-05-17 founder anexou pasta `PIXEL PERFECT/` com pacote de design completo "Dublin v3 (BAGY-style)" — protótipo React (UMD + Babel standalone) cobrindo:

- Admin SPA com 30+ rotas via hash router (`#/dashboard`, `#/produtos`, `#/vendas/pedidos`, `#/vendas/pdv`, `#/estoque`, `#/clientes`, etc.)
- Storefront mobile-first em chrome iPhone 390×844 (`storefront/vitre.css` + `vitre.jsx`)
- Login split-brand (50% navy gradient + 50% form branco)
- Onboarding wizard 4 passos (conta → identidade → tipo de negócio → pagamento/plano)
- 24KB de CSS tokenizado em `admin/v3/bagy-style.css`

Sistema atual está no redesign anterior **canvas-v1** (commits `396e7c3` storefront + `8f3c677`/`214ef26` admin + `4eb4b79` onboarding, 2026-05-09→10) — funcional, mas com identidade visual neutra carvão (`--brand: oklch(0.16 0.005 286)`). Founder considera que canvas-v1 cumpriu seu papel mas precisa do salto pra padrão "Stripe/Fly.io sério" — BAGY-inspired traz isso.

Pedido textual: **"vamos trazer o painel admin para cá. storefront, login e onboarding, vamos trazer para cá, transformar esse sistema da agua pro vinho"**.

## Diferenças principais entre canvas-v1 (atual) e Dublin v3

| Dimensão | Canvas-v1 (atual) | Dublin v3 (novo) |
|---|---|---|
| Brand color | `oklch(0.16 0.005 286)` (carvão neutro) | `#1A3A8F` navy + `#14306F` hover |
| Wash/line brand | — | `#EEF1FB` / `#C7D2EE` (tokens novos) |
| Sidebar admin | 240px, sem tabs no topo | 248px, tabs Visão/Edição/Config no topo + grupos labelados |
| Topbar admin | Mobile-only (MobileHeader) | Desktop ganha search global + cmd+K + sino + avatar |
| Create/edit padrão | Modal OR página dedicada (Shopify pattern, memory `admin-form-grande-page-not-modal`) | Drawer right slide-over 480px |
| Pills de status | shadcn `Badge` neutro | `b3-pill-{ok,warn,danger,brand,gold,silver}` — 6 variantes tinted |
| Tabelas | Cards stacked + lista | thead uppercase 11.5px + rows 64px hover (`b3-tbl`) |
| KPI cards | shadcn Card | `b3-stat` label uppercase + valor tabular-nums |
| Helpbar | — | Faixa `--brand-wash` topo de cards (NOVO) |
| Login | Single-column `AuthCard` | Split-brand 50/50 |
| Onboarding | 3 passos (conta → identidade → bem-vindo) | 4 passos (conta → identidade → tipo de negócio → bem-vindo) |
| Storefront | Responsivo nativo | Mobile-first com tokens vitre.css próprios |

## Decisão

**Adotar Dublin v3 como nova fonte visual da verdade, portando incrementalmente em 7 ondas** (0 a 6). Toda lógica de domínio é preservada — apenas refresh visual + reorganização de shell.

### Princípios do port

1. **Refresh, não rewrite**. Nenhuma action server, query Drizzle, ou regra RLS muda por causa do port. Só componentes UI e tokens.
2. **CSS Dublin extraído, não copiado bruto**. 24KB de `b3-*` viram `@layer components` em `globals.css` com apenas os padrões realmente reutilizados (`b3-card`, `b3-pill-*`, `b3-tbl`, `b3-drawer`, `b3-helpbar`, `b3-stat`, `b3-tree`). Resto absorvido em utilities Tailwind v4.
3. **Hash router SPA → Next App Router**. Cada `#/rota` Dublin tem mapeamento direto pra `page.tsx` existente em `src/app/(admin)/admin/*`. Nada de SPA client-side.
4. **Drawer right 480px adotado SÓ pra forms curtos**: categoria (3-5 campos), banner (3-5 campos), pedido detalhe (visualização). **Produto continua página dedicada** (`/admin/produtos/[id]`) — memory `admin-form-grande-page-not-modal` (validado 2026-05-13 com Shopify/Stripe/Notion pattern) prevalece. Forms ≥10 campos / upload / variantes = página, sempre.
5. **`--brand-store` (storefront por-loja) preservado**. ADR-0011 segue válido — lojista que configura cor custom continua vendo sua cor no storefront. Navy Dublin é só admin/marketing/login/onboarding.
6. **Onboarding ganha o 4º passo "tipo de negócio"** isolando os 4 cards (roupa/joia/semijoia/perfumaria) que hoje dividem espaço com identidade. O passo "pagamento/plano" do Dublin **NÃO entra** — não temos gateway, e isso vai pro roadmap pós-port quando assinatura virar feature real.
7. **Storefront refresh em cima do shell atual**, sem chrome iPhone fake. O mobile-frame 390×844 do `vitre.jsx` é artefato de protótipo (apresentação de canvas) — produção segue responsivo nativo.

### Ondas

| Onda | Escopo | Tempo estimado |
|---|---|---|
| 0 | ADR-0019 + atualização de docs/memory | algumas horas |
| 1 | Tokens & base CSS (`globals.css`, themeColor PWA) | 1 dia |
| 2 | Login + Redefinir + Recuperar split-brand | 1 dia |
| 3 | Onboarding 4 passos | 1-2 dias |
| 4 | Admin shell (sidebar tabs + topbar search + drawer) | 2-3 dias |
| 5 | Refresh módulos existentes (10 sub-ondas) | 3-5 dias |
| 6 | Storefront refresh | 2-3 dias |

Cada onda = commit próprio + verifier adversarial antes da próxima.

### Fora de escopo (backlog pós-port)

Módulos Dublin v3 que não entram porque demandam backend que não existe:

| Módulo | Por quê fora | Quando reabrir |
|---|---|---|
| Atributos produto (variantes ad-hoc → tabela própria) | Sem backend | Cliente pagante pedir |
| Cupons | Sem backend | Roadmap gestão Onda 4 |
| Grupos de cliente | Sem backend | Cliente pagante pedir |
| Equipe / roles | Cortado (memory `roadmap-sistema-gestao-completo-pos-fase-6-2026-05-16`) | Só com dor real |
| Assinatura / billing | Sem gateway | Quando Sandra pagar |
| Suporte in-app | ADR-0018 veta | ≥3 clientes pagantes |
| Marketing / Notificações | Placeholder Dublin | Roadmap pós-port |
| Admin mobile `#/mobile` PWA dedicada | Fase 6 PWA já cobriu | Não reabrir |
| Relatórios | Já está no roadmap gestão completo | Onda 2 do gestão |

## Impacto no roadmap

Pausa "Onda 2 hotfix → relatórios" da SoT `roadmap-sistema-gestao-completo-pos-fase-6-2026-05-16`. Retoma após port completo (Onda 6 fechada).

## Consequências

- ✅ Salto de qualidade visual claro: identidade BAGY-inspired sóbria, sidebar mais densa, tabelas mais profissionais, login com brand presence forte.
- ✅ Sandra (ainda não pagante) vê produto mais "sério" — pode acelerar conversão.
- ✅ Nenhuma regressão funcional esperada (refresh, não rewrite).
- ✅ CSS Dublin parametrizado entra em `@layer components` reutilizável em qualquer onda futura.
- ⚠️ Pausa de ~2 semanas no roadmap gestão completo (relatórios, produto enriquecido, import gated, fiado).
- ⚠️ ADR-0007 (cor `#1E3FE6`) e ADR-0009 (paleta navy custom + sombras brand-aware) ficam parcialmente substituídos. Marcar nos próprios ADRs.
- ⚠️ CLAUDE.md está desatualizado dizendo cor primária `#1E3FE6` — atualizar com navy `#1A3A8F` na seção "Identidade visual".
- 🔧 Dívida: alguns módulos Dublin (atributos, cupons, grupos) ficam listados como "vazios" — não entram na sidebar até o backend existir (decisão por onda).

## Quem decidiu

Anderson Felipe (founder) — anexou pacote PIXEL PERFECT/ com direcional textual "transformar da água pro vinho". Validação técnica + plano de port em 7 ondas: Claude Code (sessão 2026-05-17, plano aprovado via ExitPlanMode).
