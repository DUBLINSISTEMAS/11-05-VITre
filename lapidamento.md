# Lapidamento — Vitrê

> Auditoria sênior holística realizada em 2026-05-08 (Fase 1.6 concluída, 1.7 pendente).
> Stack: Next 15 + React 19 + Drizzle + Supabase Postgres + Better Auth + Tailwind v4 + Radix.
> Estado base: build limpo, lint zero warnings, 12/12 testes passando, hardening P0/P1 executado em 5/6 frentes.

---

## Resposta direta

O sistema está em **muito boa forma para um MVP solo**: arquitetura coerente (RSC + server actions + Drizzle + RLS-em-papel), checkout end-to-end funcional, LGPD-friendly (zero PII em `/p/`), idempotency real e estoque atômico via `UPDATE … WHERE stock_quantity >= quantity`. **Dá pra ir pra produção com a Sandra**, mas existem 4 bugs que quebram funcionalidade prometida e 1 fragilidade arquitetural que precisa ser nomeada honestamente antes do segundo lojista.

**Os 4 que travam a Fase 1.7**:

1. **PDP não mostra seletor de variante** — `product-purchase-panel.tsx:104` hardcoda `variantId: null` e o comentário da linha 10 mente dizendo "schema não tem variantes", quando `productVariantTable` existe e é consumido pelo `create-from-cart`. Qualquer produto com tamanho/cor é impossível de comprar corretamente.
2. **`createOrderFromCart` não chama `revalidateTag('store-${slug}')`** — viola explicitamente a convenção #4 do CLAUDE.md, deixa estoque stale no catálogo público por até 5min após cada pedido.
3. **Rota pública `/p/[shortCode]` está nomeada `[shortCode]` mas resolve por `publicToken`** — confusão de nomenclatura que pode virar bug se alguém bater na fallback antiga.
4. **Uploads em `product/upload-image.ts` e `banner/upload.ts` não fazem cleanup do Storage quando o INSERT no DB falha** — `store/upload-image.ts` e `category/upload-image.ts` fazem; padrão inconsistente vira lixo no bucket Free tier.

**A fragilidade arquitetural**: a "RLS-first" do CLAUDE.md hoje é **teatro de segurança**. Drizzle conecta como role `postgres` (superuser), nenhuma tabela tem `FORCE ROW LEVEL SECURITY`, e `withServiceRole` (linha 49–55 de `tenant.ts`) é literalmente um `console.warn` seguido de `fn(db)` — não muda role nenhum. Pior: das 30+ server actions, **só `update-status.ts` e `create-from-cart.ts` passam por `withTenant/withServiceRole`**. As outras 28 fazem `db.insert/update/select` direto. A defesa real hoje é o `WHERE storeId = …` manual — que está correto em todo lugar que olhei, mas é uma única linha de defesa, não duas. Nenhum bug de vazamento ativo, mas um esquecimento de filtro vira incidente cross-tenant. Não bloqueante pra Sandra (1 tenant, sem vizinhos), bloqueante antes do segundo lojista pago.

**Para onde podemos ir**: o produto está bem dimensionado — escolhas de "constraint vira design" (5 imagens/produto, max 10 banners, sem cliente final logado, custo R$0/mês) são sólidas e merecem manter. A Fase 1.7 é uma tarde de trabalho honesto se os 4 bugs acima forem fechados antes. Fase 2 (multi-tenant pleno) precisa do hardening de RLS como pré-requisito não-negociável; Fase 3 (Stripe pra cobrar lojistas) precisa do dashboard de pedidos com notificações Resend funcional. O pipeline crítico — PDP → carrinho → /sacola → server action → /sucesso → WhatsApp → /p/ — está sólido na espinha; só faltam pernas saudáveis (variantes, revalidateTag, cleanup, nome de pasta).

---

## Síntese do conselho (5 agentes)

- **AXIOMA / pressuposto invisível** — o CLAUDE.md anuncia "RLS-first, defesa em 2 camadas" mas o código entrega 1 camada (filtros app-level). Isso é normal pro MVP, mas **escreva isso honestamente em ADR-0001** — falsa segurança envenena o roadmap. Cria a expectativa de blindagem que o código não tem.

- **LÂMINA / risco mais subestimado** — variante de produto. O briefing diz "Roupa feminina + perfume árabe da Sandra"; roupa feminina é o caso de uso mais óbvio de variantes (P/M/G, cores). PDP que ignora variantes não é "feature pra Fase 2" — é regressão silenciosa que vai aparecer no primeiro produto real cadastrado. O comentário mentiroso ("Sem variantes (não fazem parte do schema)") sugere que o port do bewear deixou um hardcode esquecido.

- **TRATOR / custo real de fechar** — ~6h de trabalho focado pra zerar a lista crítica:
  - Variant selector na PDP (~2h, código já existe no `variant-editor` admin)
  - `revalidateTag` no checkout (~10min)
  - Renomear pasta `[shortCode]→[token]` ou aceitar ambos (~30min)
  - Cleanup orfão em 2 uploads (~1h, copiar de `store/upload-image`)
  - Prompt de unsaved changes (~1h)
  - Redirect `/entrar` em sessão expirada (~30min)
  - Bug L450 inerte (~5min)

  Hardening completo de RLS (FORCE + role custom + 100% withTenant) é dia inteiro — dá pra deixar pra antes do segundo lojista.

- **NEXUS / efeito de segunda ordem** — a falta de `revalidateTag` no checkout interage com a métrica de "Lighthouse mobile ≥ 90" da Fase 1.7. ISR funcionando direito é o que dá performance — mas se o cache não invalida em mutações críticas, vai começar a empilhar dívida silenciosa de coerência no catálogo. Cancelamento de pedido também não invalida o storefront (`update-status.ts:99-100` só revalida `/admin/pedidos`), e cancel repõe estoque — produto fica "esgotado" por mais 5min depois de já ter sido reposto. Para Sandra com <10 pedidos/dia isso é invisível; para 100 lojistas vira reclamação semanal.

- **ESPELHO / Sandra real** — ela vai cadastrar um vestido tamanho M e P em duas variantes, e descobrir que cliente compra "M" mas chega como produto-sem-variante no WhatsApp dela. Confusão. Custo de suporte alto. Igualmente: ela edita preço, sai da tela sem salvar (sem prompt), perde tudo, culpa o sistema. Os dois casos são previsíveis e ela vai topar nos primeiros 30 dias.

- **Tensão real não resolvida** — você tem um plan P0/P1 escrito (`docs/superpowers/plans/2026-05-08-hardening-p0-p1.md`) que documenta 6 tasks. 5 estão executadas, mas a Task 2 (RLS hardening) parou na metade — fez o "remover policies perigosas" e deixou o "FORCE RLS + role não-superuser" para depois. Decisão pragmática defensável **se** for explícita; hoje só está implícita. Trade-off central: ir pra deploy agora com 1 camada de defesa real, ou gastar 1 dia pra ter as 2. Para Sandra sozinha, GO; para multi-lojista pago, gate.

---

## Lista priorizada de findings

### 🔴 P0 — Bloqueia Fase 1.7 (deploy)

| # | Onde | O quê | Fix |
|---|---|---|---|
| 1 | `src/components/storefront/product-purchase-panel.tsx:10,104` | Variant selector ausente; `variantId: null` hardcoded; comentário mente sobre schema | Adicionar UI de seleção quando `product.variants.length > 0`, com estoque dinâmico por variante. Padrão pronto em `src/components/admin/variant-editor.tsx` |
| 2 | `src/actions/order/create-from-cart.ts` (final do happy path) | Sem `revalidateTag('store-${slug}')` | Adicionar antes do `return { ok:true, ... }` |
| 3 | `src/app/p/[shortCode]/page.tsx:43-44` | Pasta `[shortCode]` mas resolve `publicToken`; quebra link com 4-char | Renomear pasta para `[token]` OU aceitar ambos via fallback `getOrderByShortCode` |
| 4 | `src/actions/product/upload-image.ts:186-188` e `src/actions/banner/upload.ts:143` | Sem cleanup do Storage em falha de DB pós-upload (orfãos no bucket Free) | Copiar padrão de `store/upload-image.ts:122-126` (try/finally) |

### 🟠 P1 — Importante, fechar antes da Fase 2

| # | Onde | O quê | Fix |
|---|---|---|---|
| 5 | `src/lib/tenant.ts:49-55` + 28 server actions | "RLS-first" é teatro: superuser + `withServiceRole` cosmético + cobertura ~5% | Criar role `app_tenant` Postgres não-superuser, mover `DATABASE_URL`, `FORCE RLS` em todas as tabelas de domínio, padronizar `withTenant` em 100% das mutações. **Atualizar ADR-0001 com a verdade atual.** |
| 6 | `src/actions/order/create-from-cart.ts:435,439` | String-match em mensagem Postgres em vez de `code === '23505'` | Usar `isUniqueViolation` + `getConstraintName` de `lib/db-errors.ts` |
| 7 | `src/actions/product/update.ts:204` | `trackStock: v.stockQuantity !== null` sobrescreve intent do schema | Usar `v.trackStock` direto |
| 8 | `src/actions/order/update-status.ts:99-100` | Cancel/expire repõe estoque mas não invalida cache do storefront | Adicionar `revalidateTag('store-${slug}')` |
| 9 | `src/components/admin/product-form.tsx` + `store-config-form.tsx` | Sem prompt "alterações não salvas" — Sandra perde edições silenciosamente | Hook `useUnsavedChangesWarning(isDirty)` com `beforeunload` + route guard |
| 10 | Server actions em geral | Sessão expirada mid-form não redireciona pra `/entrar` | Wrapper `requireSessionOrRedirect` retornando `{ ok:false, errorCode:'SESSION_EXPIRED', redirectTo:'/entrar' }` consumido no client |

### 🟡 P2 — Polimento

| # | Onde | O quê |
|---|---|---|
| 11 | `src/app/(storefront)/[storeSlug]/produto/[productSlug]/page.tsx:82-86` | JSON-LD `availability`: ramo `hasActivePromo` ignora `isOutOfStock` (marca InStock mesmo esgotado) |
| 12 | `src/app/sitemap.ts:81-88` | Falta `/destaques` e `/novidades` no loop por loja |
| 13 | `src/lib/slug.ts` | Reservar `destaques`, `novidades`, `sucesso` por consistência |
| 14 | `src/app/api/cron/keep-alive/route.ts:19-22` | Comparação de `Bearer` não é timing-safe (`crypto.timingSafeEqual`) |
| 15 | `src/components/onboarding/slug-input.tsx:46-48` | `useEffect` deps `[onAvailabilityChange]` instável; estabilizar via ref |
| 16 | `src/actions/order/create-from-cart.ts:449-450` | `createdOrderId = existingRace.id;` duplicado (inerte mas indica refactor incompleto) |
| 17 | `src/components/storefront/product-purchase-panel.tsx:10` | Comentário falso "Sem variantes (não fazem parte do schema)" — apagar |
| 18 | `src/lib/auth-client.ts:14` | `process.env.NEXT_PUBLIC_APP_URL` direto; usar `env` validado |
| 19 | `src/actions/product/save-and-create-next.ts:65` | Rate-limit duplo (gasta 2 tokens por save+next) |
| 20 | `src/components/storefront/category-circles.tsx:41` | Link "Todos" sem `aria-label` específico |
| 21 | `src/actions/store/update.ts` | Sem validação de luminância da `primaryColor` (lojista pode escolher cor com falha AA contra `text-primary-foreground`) |
| 22 | `src/components/admin/product-form.tsx:101` | Imagens fora do RHF — `isDirty` não detecta troca de galeria |

### 🟢 Pontos fortes a manter (não mexer)

- Idempotency com retry de shortCode + UNIQUE `(storeId, idempotencyKey)`
- Estoque atômico via `UPDATE WHERE stock_quantity >= quantity` (linhas 345–383 de `create-from-cart.ts`)
- `Promise.race(action, 800ms timeout)` em `whatsapp-open-button.tsx:49-52` (mitigação real do bug `window.location.href` síncrono cancelando fetch)
- `unstable_cache` + tag `store-${slug}` consistente em todos os 6 loaders
- Anti-enumeração em `request-password-reset.ts:48-52`
- Last-request-wins em `slug-input.tsx` via `checkSeq.current`
- 12 testes de regressão cobrindo public-order/RLS/admin actions
- Skip link, focus-visible, viewport sem maximumScale, bottom-nav `aria-current`
- Cleanup de blob URLs via `pendingRef` no image-uploader
- RLS policies já corrigidas (sem `USING (true)` perigoso em order/order_item)
- `publicToken` opaco (24 chars URL-safe ≈ 142 bits) substituindo `shortCode` na rota pública
- Sharp pipeline 800×800 WebP 75% antes de cada upload
- Validação Zod em todos os boundaries (server actions, env vars)
- Rate limit em todas as ações sensíveis (auth, order, upload, mutation, publicApi)

---

## Veredito

**GO COM RESSALVAS** — feche P0 #1–#4 (estimativa 4h) antes do deploy 1.7. P1 #5 (RLS real) é dívida nomeada que precisa virar plan formal antes do segundo lojista pago.

---

## Discrepâncias encontradas (atualizar)

- **`CLAUDE.md`** diz "Fase 1.4 concluída"; **`docs/CONTEXT.md`** diz "Fase 1.6 concluída". CONTEXT.md é o atualizado — sincronizar CLAUDE.md.
- **ADR-0001** anuncia "RLS é 2ª linha de defesa"; o código atual entrega 1 linha (filtros app-level). Atualizar com a verdade ou implementar.
- **Plan `docs/superpowers/plans/2026-05-08-hardening-p0-p1.md`** tem checkboxes `- [ ]` mas a maioria dos itens foi de fato executada. Marcar como `- [x]` ou arquivar.

---

## Próximos passos sugeridos (ordem de execução)

1. **Sprint de fechamento P0** (4–6h) — variantes na PDP, revalidateTag no checkout, renomear pasta `/p/[token]`, cleanup orfão em 2 uploads.
2. **Re-rodar `npm test && npm run lint && npm run build`** — confirmar que nada quebrou.
3. **Deploy Fase 1.7** — Vercel + buckets prod + cron + seed Sandra (escopo do CONTEXT.md).
4. **Smoke test em produção** — pipeline completo do PDP ao WhatsApp pelo celular.
5. **Antes do segundo lojista**: plan formal de hardening RLS (role custom + FORCE + cobertura 100% withTenant + lint rule banindo `import { db }` em `src/actions/**`).
