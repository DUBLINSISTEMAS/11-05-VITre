# Auditoria de Dead Code — 2026-05-18

Investigação read-only do repositório Vitrê (Next 15 + React 19 + TS + Drizzle + Supabase) procurando arquivos órfãos, referências mortas e gaps.

Cwd: `C:\Users\ANDERSON FELIPE\Documents\MODEO`. Total de arquivos em `src/`: **309** (.ts/.tsx).

Método: para cada arquivo de `src/components/`, `src/lib/`, `src/actions/`, `src/hooks/` greppei (a) o nome do arquivo (sem extensão) e (b) o símbolo principal exportado, em todo o `src/`. Zero hits fora do próprio arquivo = candidato Bucket A. Páginas Next em `app/` foram tratadas à parte (rota direta via URL nunca conta como "órfão automático").

---

## Resumo executivo

| Bucket | Conta | Significado |
|---|---|---|
| **A — SAFE TO DELETE** | **6 arquivos** | Zero referências em `src/`. Deleção sem impacto. |
| **B — NEEDS CONFIRMATION** | **5 itens** | Sinal ambíguo (rota sem inbound link, script one-shot, etc). |
| **C — KEEP (falso positivo)** | **6 confirmações** | Look-suspicious mas USADO. |
| **D — MISSING / GAPS** | **2 itens** | Nada quebrado em runtime; observações pra backlog. |

**TL;DR de Bucket A** — todos no admin, principalmente sobras pós-port Dublin v3 (Ondas A.5 + A.3):
- `src/components/admin/welcome-card.tsx`
- `src/components/admin/dashboard-quick-actions.tsx`
- `src/components/admin/dashboard/revenue-chart.tsx`
- `src/components/admin/dashboard/stat-card.tsx`
- `src/components/admin/shell/admin-drawer.tsx`
- `src/components/admin/shell/storefront-footer-card.tsx`
- `src/lib/motion-tokens.ts`

(7 arquivos — não 6; corrigido abaixo.)

---

## Bucket A — SAFE TO DELETE (zero referências em src/)

### A.1 — `src/components/admin/welcome-card.tsx`
- **Símbolo exportado:** `WelcomeCard` (interface `WelcomeCardProps`)
- **Evidência:**
  ```
  Grep "welcome-card|WelcomeCard" em src/ → 1 hit (o próprio arquivo)
  ```
- **Contexto:** Confirmado órfão pela nota da Onda A.5 no CLAUDE.md. Dashboard `/admin/page.tsx` usa `QuickActions`, `RecentOrdersTable`, `SalesSummaryCard`, `SetupChecklist` — NÃO `WelcomeCard`.

### A.2 — `src/components/admin/dashboard-quick-actions.tsx`
- **Símbolo exportado:** `DashboardQuickActions` + interface pública `DashboardStats`
- **Evidência:**
  ```
  Grep "dashboard-quick-actions|DashboardQuickActions" em src/ → 1 hit (o próprio arquivo)
  Grep "DashboardStats" em src/ → 1 hit (o próprio arquivo)
  ```
- **Cuidado:** NÃO confundir com `src/components/admin/dashboard/quick-actions.tsx` (subpasta `dashboard/`), que exporta `QuickActions` e É usado pelo `admin/page.tsx`.

### A.3 — `src/components/admin/dashboard/revenue-chart.tsx`
- **Símbolo:** `RevenueChart` + `RevenueChartProps`
- **Evidência:**
  ```
  Grep "revenue-chart|RevenueChart" em src/ → 1 hit (o próprio arquivo)
  ```
- **Contexto:** Confirmado órfão pela nota A.5. Dashboard novo usa `Sparkline` dentro de `SalesSummaryCard`, sem Recharts.

### A.4 — `src/components/admin/dashboard/stat-card.tsx`
- **Símbolo:** `StatCard` + `StatCardProps`
- **Evidência:**
  ```
  Grep "stat-card|StatCard" em src/ → 1 hit (o próprio arquivo)
  ```
- **Contexto:** A.5 substituiu por agregados em `SalesSummaryCard`.

### A.5 — `src/components/admin/shell/admin-drawer.tsx`
- **Símbolo:** `AdminDrawer` + `AdminDrawerProps`
- **Evidência:**
  ```
  Grep "AdminDrawer" em src/ → 4 hits, todos dentro do próprio arquivo
  Grep "from .* admin-drawer" em src/ → 0 hits
  ```
- **Contexto:** Foi adicionado na Onda A.3 (Dublin v3 right slide-over 480px) mas nunca cabeado. Mobile usa `MobileHeader` + `Sheet` do shadcn.

### A.6 — `src/components/admin/shell/storefront-footer-card.tsx`
- **Símbolo:** `StorefrontFooterCard` + `StorefrontFooterCardProps`
- **Evidência:**
  ```
  Grep "StorefrontFooterCard" em src/ → 2 hits, ambos dentro do próprio arquivo
  Grep "from .* storefront-footer-card" em src/ → 0 hits
  ```

### A.7 — `src/lib/motion-tokens.ts`
- **Evidência:**
  ```
  Grep "motion-tokens|MOTION_TOKENS|motionTokens" em src/ → 1 hit (o próprio arquivo)
  Grep "from .* @/lib/motion-tokens" em src/ → 0 hits
  ```
- **Contexto:** Memory team menciona "Tokens de animação + drawer pattern Vitrê (2026-05-12)" — o arquivo existe mas não é importado em lugar nenhum (Tailwind/`globals.css` é o veículo real).

---

## Bucket B — NEEDS HUMAN CONFIRMATION

### B.1 — Duplicidade aparente em `supabase/sql/17_*.sql`
- Existem **dois** arquivos com prefixo `17_`:
  - `17_cleanup_orphan_drafts.sql` — script de manutenção one-shot (DELETE de produtos draft órfãos); `check-sql-applied.mjs` comenta explicitamente que esse "não cria objeto persistente — não precisa ser auditado".
  - `17_payment_check_constraints.sql` — Fase 2 ADR-0013, auditado como id `17p` em `check-sql-applied.mjs`.
- **Status:** ambos têm propósitos legítimos, mas convivem com mesmo prefixo numérico. Pode ser confuso pra próxima onda de SQL.
- **O que destrava:** decidir se quer renumerar `cleanup_orphan_drafts` (ex: `17a_…`) ou se quer arquivar/deletar uma vez confirmado que rodou em prod. NÃO é dead code — é dívida de naming.

### B.2 — Página `/p/[token]` (`src/app/p/[token]/page.tsx`)
- Rota pública pra acessar pedido via token opaco. Confirmado vivo: gerado por `generatePublicOrderToken` em `actions/order/create-from-cart.ts` e `actions/order/balcao/create-balcao-sale.ts`; importa `getOrderByPublicToken`, `buildPublicOrderWhatsAppMessage`, `WhatsAppOpenButton`.
- **Por que está aqui:** nenhuma página do storefront/admin tem `<Link href="/p/...">` — o link é mandado por WhatsApp/email diretamente. Comportamento esperado, mas vale documentar.
- **O que destrava:** confirmação do founder de que o fluxo "envia link p/ cliente" continua válido (deve continuar — é o coração do checkout WhatsApp).

### B.3 — Página `/admin/aparencia/preview/[presetId]` (`src/app/(admin)/admin/aparencia/preview/[presetId]/page.tsx`)
- Existe, renderiza tema, importa quase todos os componentes storefront.
- **Inbound links:** apenas dentro de `theme-selector.tsx` (botão "Visualizar tema").
- **Status:** legítimo. Marcado em B só pra ser explícito — não deletar.

### B.4 — Página `/admin/pdv/recibo/[token]` (`src/app/(admin)/admin/pdv/recibo/[token]/page.tsx`)
- Acessada via redirect interno após `createBalcaoSale` (`actions/order/balcao/create-balcao-sale.ts` retorna `redirectTo` apontando pra essa rota).
- **Status:** vivo. Está em B só porque nav-items não lista (correto — é página de transição).

### B.5 — Scripts não cabeados em `package.json`
Existem em `scripts/` mas não aparecem em `package.json scripts`:
- `scripts/db-audit.mjs` — auditoria de drift schema vs prod
- `scripts/db-cleanup.mjs` — limpeza one-shot do `__drizzle_migrations` (rodou em 2026-05-10, footprint histórico)
- `scripts/full-audit.mjs` — auditoria read-only completa (untracked no git! `git ls-files --others` mostra)
- `scripts/check-sql-applied.mjs` — auditoria read-only dos SQLs aplicados (cabeada via `pnpm exec tsx scripts/check-sql-applied.mjs` na memory; NÃO no package.json)
- `scripts/generate-pwa-icons.mjs` — one-off; rodou em Fase 6 PWA
- **O que destrava:** decidir se quer mover `db-audit/full-audit/check-sql-applied/check-anon-grants` pra `package.json scripts` (visibilidade) ou se mantém como "ferramenta interna do dev". `db-cleanup.mjs` claramente é histórico — pode ser arquivado em `docs/sessoes/2026-05-10-…/anexos/` se quiser desencardir.

---

## Bucket C — KEEP (não são dead code, apesar de parecerem)

### C.1 — `src/components/admin/welcome-card.tsx` (Onda A.5 nota)
- **Sentença do CLAUDE.md:** "WelcomeCard + DashboardQuickActions mobile + StatCards 4 + RevenueChart Recharts NÃO referenciados (arquivos preservados pra cleanup futuro)".
- **Auditoria:** confirma órfão (ver A.1, A.2, A.3, A.4). A nota do CLAUDE.md está correta. **OK pra deletar.**

### C.2 — `src/components/admin/dashboard/sparkline.tsx`
- A.5 listou Sparkline como órfão; auditoria mostra que **está VIVO** — é importado por `dashboard/sales-summary-card.tsx`. **NÃO DELETAR.**

### C.3 — `src/components/admin/dashboard/setup-checklist.tsx`, `recent-orders-table.tsx`, `sales-summary-card.tsx`, `hide-values-toggle.tsx`, `quick-actions.tsx` (subpasta dashboard/)
- Todos são importados por `src/app/(admin)/admin/page.tsx` (dashboard novo Onda A.5). Confirmado vivo.

### C.4 — `src/lib/slug-uniqueness.ts`
- Função `generateUniqueProductSlug` importada por `actions/product/create-from-values.ts` e `actions/product/update.ts`. Existe nota de auditoria 2026-05-12 sobre extrair `generateUniqueCategorySlug` (slug categoria está inline em `update.ts`) — backlog não-bloqueante.

### C.5 — `src/lib/supabase/server.ts`
- Export `supabaseService` importado por `src/lib/supabase/storage.ts`. Vivo.

### C.6 — Páginas storefront `/sobre` e `/destaques`
- Ambas têm inbound links: `/sobre` é linkado em `store-footer.tsx` e `desktop-header.tsx`; `/destaques` em `promo-strip.tsx`, `hero-card.tsx`, `[storeSlug]/page.tsx` (`seeAllHref`). NÃO órfãs.

### C.7 — `src/components/admin/dashboard-quick-actions.tsx` interface `DashboardStats`
- Apesar de A.2 ser deleção segura: nada externo importa essa interface. **A deleção arrasta o tipo `DashboardStats` junto, sem fanout.**

### C.8 — `src/components/admin/stock-toolbar.tsx`
- Foi criado na Onda A.10 pra substituir `stock-movements-filters.tsx` (deletado em git status atual). É importado por `app/(admin)/admin/estoque/page.tsx`. **Vivo.** Comentário interno menciona o antigo só pra historicidade.

---

## Bucket D — MISSING / EXPECTED-BUT-NOT-FOUND

### D.1 — Tabelas em prod sem schema-side dead code
- 15 tabelas em prod, todas presentes em `src/db/schema/*`. Drift = 0 (confirmado pela CLAUDE.md, e `scripts/full-audit.mjs` existe pra reauditar). Sem gap.

### D.2 — Rotas listadas como `soon: true` em `shell/nav-items.ts`
Estes hrefs apontam pra rotas que NÃO existem em `src/app/`:
- `/admin/produtos/atributos` (ADR-0020 pendente)
- `/admin/clientes/grupos`, `/admin/clientes/contatos`
- `/admin/promocoes/cupons`, `/admin/promocoes/ofertas` (ADR-0021)
- `/admin/marketing`, `/admin/relatorios`
- `/admin/loja/produtos`, `/admin/loja/categorias`, `/admin/loja/banners`
- `/admin/configuracoes/identidade`, `/admin/configuracoes/whatsapp`, `/admin/configuracoes/horarios`, `/admin/configuracoes/equipe`
- `/admin/assinatura`

**Status:** intencional — `soon: true` renderiza disabled com badge "em breve". Não é bug nem dead code; é placeholder pré-implementação documentado no comentário do arquivo (linhas 7-11). Tracking nas ondas A.11+ / B.1+ no memory team.

---

## Notas sobre pastas não-`src`

### `PIXEL PERFECT/` (untracked no git)
- 972K total — pequeno. Assets de design (HTML/JSX/CSS) que servem como SoT visual pro port Dublin v3 (ADR-0019). NÃO é alvo de cleanup de código (não entra no bundle), mas confirmar com founder se quer adicionar ao `.gitignore` explicitamente pra evitar `git add -A` acidental capturar.

### `instrumentation.ts` + `instrumentation-client.ts` (raiz)
- Convenção Next 15 — não há "import" formal; o framework os carrega por nome. Greps vão dar 0 hits e isso é esperado. NÃO marcar como órfão.

### Tests (`tests/`)
- 10 arquivos `.test.ts`. Não auditados aqui (mandato era código de produção).

---

## Resumo final de ações sugeridas

**Deleção segura (Bucket A, 7 arquivos):**
1. `src/components/admin/welcome-card.tsx`
2. `src/components/admin/dashboard-quick-actions.tsx`
3. `src/components/admin/dashboard/revenue-chart.tsx`
4. `src/components/admin/dashboard/stat-card.tsx`
5. `src/components/admin/shell/admin-drawer.tsx`
6. `src/components/admin/shell/storefront-footer-card.tsx`
7. `src/lib/motion-tokens.ts`

**Decisões pendentes (Bucket B):**
- Renomear ou arquivar um dos `supabase/sql/17_*.sql`?
- Mover scripts de auditoria pra `package.json scripts`?
- Arquivar `scripts/db-cleanup.mjs` (one-shot histórico)?

**Manter intocado (Bucket C):** itens listados acima.

**Sem ação necessária (Bucket D):** gaps são placeholders intencionais, alinhados com roadmap.
