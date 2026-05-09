# 2026-05-07 — Sessão Fundadora do Vitrê

Sessão inicial: análise do repositório base + decisões arquiteturais via conselho-5-agentes.

## Contexto

Anderson recebeu projeto "bewear-bootcamp" de um curso (loja B2C single-tenant com Stripe). Quer transformar em SaaS chamado **Vitrê** — catálogo digital com checkout via WhatsApp para lojas de pequeno/médio porte. Já tem cliente real esperando: Sandra Brito Collection (Pedreiras-MA).

## Análise do repo base

**Stack que vale ouro (manter):**
- Next 15.4 App Router + React 19 + TypeScript
- Drizzle ORM + Postgres (node-postgres)
- Better Auth (e-mail/senha + Google OAuth)
- TanStack Query
- shadcn/ui (new-york, neutral) + Tailwind v4
- react-hook-form + Zod
- Sonner (toasts)

**Schema atual (refazer):** single-tenant B2C. user/session/account/verification (Better Auth), category, product (sem preço, sem estoque, sem ativo/inativo, sem múltiplas imagens), product_variant (1 imagem só), cart, cart_item, shipping_address, order, order_item.

**Fluxo atual (descartar):** usuário loga → carrinho exige sessão → endereço → finishOrder → createCheckoutSession Stripe → webhook marca paid.

**Veredito**: stack vale ouro; schema e fluxos precisam ser refeitos.

## Decisões tomadas

1. **Repo limpo, mas preservando referência**: mover legado para `_legacy-bewear/`, reescrever `src/` do zero. Ver [ADR 0001](../decisoes/0001-multi-tenant-rls-postgres.md).
2. **Multi-tenant via Postgres RLS desde a primeira migration**. `store_id` em todas as tabelas de domínio.
3. **Path-based routing**: `vitre.com.br/[storeSlug]`. Subdomínio fica para depois. Ver [ADR 0004](../decisoes/0004-routing-path-based.md).
4. **Supabase Storage** para imagens (mesmo vendor do DB). Ver [ADR 0003](../decisoes/0003-supabase-storage-imagens.md).
5. **Catálogo público sem login**, carrinho em `localStorage`. Better Auth só no `/admin`.
6. **Checkout WhatsApp com código curto** registrado server-side antes do redirect. Ver [ADR 0002](../decisoes/0002-checkout-whatsapp-codigo-curto.md).
7. **Hospedagem**: Vercel (domínio Vercel grátis até comprar `.site`).
8. **Email transacional**: Resend.
9. **Documentação**: `docs/` versionado no repo + Obsidian como vault adicional.
10. **Cobrança Vitrê**: só na Fase 3 (Stripe pra mensalidade do SaaS — não confundir com checkout do catálogo).
11. **Pasta de logos**: renomear `logo vitrê/` para `public/brand/` (sem acentos no path).

## Conselho-5-agentes — destaques do debate

- **AXIOMA**: o repo entrega tooling, não arquitetura. Confundir isso é o erro estratégico nº 1.
- **LÂMINA**: bolt-on multi-tenancy é a ruína de 90% dos SaaS pequenos. Decidir RLS ANTES da primeira migration.
- **TRATOR**: 3-4 meses solo full-time pra MVP minimamente vendável.
- **NEXUS**: path-based resolve com 1/10 do esforço de subdomínio sem perda funcional para o público-alvo.
- **ESPELHO**: lojista de cidade do interior abandona se cadastrar produto > 60s no mobile. Onboarding ≤ 5 min é meta de UX.

## Cliente piloto

[Sandra Brito Collection](../clientes/sandra-brito-collection.md) — Pedreiras-MA, roupa feminina + perfume árabe.

## Próximos passos imediatos

1. ✅ Conectar Obsidian (criar `docs/`, `.gitignore`).
2. ⏳ Mover legado para `_legacy-bewear/`.
3. ⏳ Renomear `logo vitrê/` → `public/brand/`. Mover Lottie para `public/lottie/order-approved.json`.
4. ⏳ Limpar `package.json` (remover Stripe, adicionar Supabase + Lottie + libphonenumber-js + sharp + slugify + nanoid).
5. ⏳ Reescrever estrutura de `src/`.
6. ⏳ Schema multi-tenant + RLS no Supabase.
