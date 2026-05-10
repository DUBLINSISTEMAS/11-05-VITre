# ADR-0010 — Redesign canvas-v1 (Lotes 1–4)

- **Status**: Aceito
- **Data**: 2026-05-10 (registro retroativo)
- **Autor**: Anderson Felipe (founder)

## Contexto

Entre 2026-05-09 e 2026-05-10 o produto foi inteiramente revisitado visualmente a partir de uma referência em `canvas-referencia.html` (extraído via `scripts/extract-canvas.cjs` para `canvas-extracted/_vitre-*.jsx`). O design canvas-v1 cobre 3 superfícies: storefront público, painel administrativo da lojista, e onboarding (criar-loja).

A migração foi feita em **4 lotes sequenciais**, cada um com escopo bem definido e commits de referência.

Decisão de **rewrite from scratch** (não tradução de v2/ legacy) foi tomada porque a migração intermediária tinha perda de fidelidade — ver memory `redesign-canvas-v1-2026-05-09`. Fonte de verdade canônica é o canvas extraído, não uma tradução cumulativa.

## Decisões

### 1. Lote 1+2 — Storefront (commit `396e7c3`)

- **Escopo**: home, header, PDP, sacola, sucesso, página de categoria.
- **Pegada visual**: minimalista premium, cor brand-store por loja (ADR-0011), CTAs primários em `bg-foreground` preto (nichos joia/semijoia da Sandra, ver memory `sandra-brito-cta-preto-premium`), navy frio neutro, surfaces translúcidas.
- **BottomNav**: 4 itens (ADR-0008), 3 variants (`pill` | `rule` | `glass`) selecionáveis por loja em `store.bottom_nav_style`.
- **Banners**: campos editoriais (`overline`, `headline`, `body`, `ctaLabel`, `ctaHref`) adicionados ao `bannerTable` (migration `0007_peaceful_krista_starr`).

### 2. Lote 3 — Admin (commits `8f3c677` ondas 0-5 + `214ef26` ondas 6-7)

- **Escopo**: shell, dashboard, catálogo, editar produto, pedido detalhe, categorias, banners, configurações.
- **Auditor visual fechou em 67% global** com 5 fixes top aplicados; dívida visual residual ficou registrada como backlog (ver memory `redesign-canvas-v1-lote3-admin-scope`).
- **Tipografia auxiliar**: utilities `text-eyebrow` (mono 10px upper) e `text-hero-num` (28px tabular-nums) recorrentes nos stat cards.

### 3. Lote 4 — Onboarding (commit `4eb4b79`)

- **Escopo**: 3 telas de `/criar-loja` + shell + storage-keys (localStorage para preservar progresso entre etapas).
- **Verifier**: PASS 15/15, build verde 35 rotas.

### 4. Auditoria pré-deploy 2026-05-10 — limpeza pós-canvas-v1

- 5 relatórios em `docs/sessoes/2026-05-10-auditoria-completa/`.
- **framer-motion removido** (Onda 4) — todas as animações vão por CSS (`tw-animate-css` + keyframes custom em `globals.css`). Trade-off explícito: partículas ornamentais do `favorite-button` foram simplificadas; `category-pills` perdeu o efeito morph entre pills (`layoutId` shared transition).
- **`/perfil` deletado** (Onda 3) — linkava pra rotas inexistentes; `/sobre` cobre info da loja.
- **Bottom-nav "Categorias"** agora abre o `CategoriesSidebar` drawer (não navegava pra `/categoria` inexistente).
- **`banner-carousel.tsx` deletado** — substituído por `HeroCard` no canvas; skeleton renomeado para `HeroCardSkeleton`.

## Consequências

### Positivas
- UX coerente entre storefront/admin/onboarding (mesma família tipográfica, mesmos tokens navy frios, mesmo padrão de surfaces).
- BottomNav configurável por loja (variant) sem deploy.
- Bundle reduzido pós-remoção do framer-motion (~30 kb).
- Storefront pixel-a-pixel com canvas referência (Lote 1+2).

### Trade-offs aceitos
- Auditor visual do admin fechou em 67% (não 100%) — algumas dívidas visuais ficam pra próximos lotes.
- Animações CSS são menos sofisticadas que motion (sem spring physics nem shared layout transitions reais).
- Custo de manutenção do `canvas-referencia.html`: qualquer evolução visual implica revisitar tanto o canvas quanto a implementação.

### Fora de escopo
- Lote 5+ (outras telas reservadas pelo founder pós-deploy Fase 1.7) — não documentado ainda neste ADR; quando aplicado, criar ADR-0010-followup ou substituir esta seção.

## Referências
- `canvas-referencia.html` (fonte de verdade visual)
- `canvas-extracted/_vitre-*.jsx` (extração utilitária)
- Memory team: `redesign-canvas-v1-2026-05-09`, `redesign-canvas-v1-lote2-decisoes`, `redesign-canvas-v1-lote3-admin-scope`, `redesign-canvas-v1-lote4-onboarding`
- ADR-0008 (UX storefront — ainda válido)
- ADR-0009 (tokens navy — ainda válido)
- ADR-0011 (brand-store scoping — ainda válido)
