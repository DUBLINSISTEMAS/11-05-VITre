# Vitrê — Documentação

Segundo cérebro do projeto. Toda decisão técnica importante mora aqui.

## Estrutura

- **produto/** — visão, personas, roadmap
- **decisoes/** — ADRs (Architecture Decision Records)
- **clientes/** — cada cliente piloto vira um arquivo
- **sessoes/** — logs de sessões de planejamento e conselho-5-agentes
- **runbooks/** — operacionais (deploy, onboarding tenant, troubleshooting)
- **glossario.md** — termos do projeto

## Como usar no Obsidian

Abra a pasta raiz do repo (`vitre/`) como vault adicional no Obsidian. Configurações locais ficam em `.obsidian/` (ignorado pelo git). Notas pessoais sensíveis devem ficar em vault separado, fora do repo.

Plugins recomendados:
- **Templater** — templates de ADR
- **Dataview** — índice automático
- **Excalidraw** — diagramas de arquitetura

Use links markdown padrão (`[texto](caminho.md)`), não wikilinks — funcionam no GitHub também.

## Atalhos

- **[📐 Arquitetura técnica completa](arquitetura-tecnica.md)** ← documento mestre, do schema ao deploy
- [Visão do produto](produto/visao.md)
- [Personas](produto/personas.md)
- [Roadmap](produto/roadmap.md)
- [ADR 0001 — Multi-tenant + RLS](decisoes/0001-multi-tenant-rls-postgres.md)
- [ADR 0002 — Checkout WhatsApp](decisoes/0002-checkout-whatsapp-codigo-curto.md)
- [ADR 0003 — Supabase Storage](decisoes/0003-supabase-storage-imagens.md)
- [ADR 0004 — Routing path-based](decisoes/0004-routing-path-based.md)
- [ADR 0005 — Tier free (Supabase + Vercel + Resend)](decisoes/0005-free-tier-supabase-vercel-resend.md)
- [ADR 0006 — Rate limit com Upstash](decisoes/0006-rate-limit-upstash.md)
- [ADR 0007 — Identidade visual Vitrê](decisoes/0007-identidade-visual-vitre.md)
- [ADR 0008 — UX do catálogo público (storefront)](decisoes/0008-ux-catalogo-publico-storefront.md)
- [📌 CONTEXT.md — briefing rápido](CONTEXT.md)
- [Sessão 2026-05-07 — Fase 1.1 fechada](sessoes/2026-05-07-fase-1-1-completa.md)
- [Cliente piloto: Sandra Brito Collection](clientes/sandra-brito-collection.md)
- [Sessão fundadora 2026-05-07](sessoes/2026-05-07-conselho-fundacao.md)
- [Glossário](glossario.md)
