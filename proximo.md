# Próximo passo — Vitrê

> **Use este arquivo como ponto de retorno entre sessões.**
> Atualizado: 2026-05-09 (pós-Onda 1)

---

## 🟢 Onde estamos

**Onda 1 (Estabilização) — CONCLUÍDA**

Commits no master:
```
0bdf16a  reescopo: brand color só no bottom-nav e badge sacola (ADR-0011)
ceee6b3  PDP: seletor de variante com estoque dinâmico e preço por variante
b92e0a6  Estado pós-Chat 1 (P0 #2/#3/#4 fechados)
```

Estado: 39/39 testes verde · lint zero warnings · build limpo (21 páginas) · ADR-0011 escrito · token `--brand-store` isolado · variant selector funcionando · `revalidateTag` em `createOrderFromCart`/`updateOrderStatus` · pasta `/p/[token]` renomeada · cleanup de uploads órfãos em `product/upload-image.ts` e `banner/upload.ts`.

**Auditoria base**: `lapidamento.md` (raiz) — 22 findings priorizados em P0/P1/P2.

---

## 🧪 Smoke tests pendentes (FAZER ANTES da Onda 2)

Validar visualmente em `npm run dev`:

### A. Reescopo brand color
1. Login admin → `/admin/configuracoes`
2. Trocar cor primária pra **`#10B981`** (verde) e salvar
3. Abrir `localhost:3000/sandra-brito`
4. Confirmar visualmente:
   - ✅ Bottom-nav (item ativo) = VERDE
   - ✅ Badge contador da sacola no header = VERDE
   - ✅ Skip link (Tab pra ver) = AZUL VITRÊ
   - ✅ Preço promo (se houver) = VERMELHO ROSE
   - ✅ Focus rings (Tab navegando) = NEUTRO/Vitrê
   - ✅ Botão "Adicionar à sacola" = AZUL VITRÊ
   - ✅ Chip de variante selecionada = AZUL VITRÊ
5. Voltar cor pra `#1E3FE6` e confirmar consistência

### B. Variant selector PDP
1. `/admin/produtos/novo`: cadastrar "Vestido teste" com 3 variantes:
   - **P** — R$ 50 — estoque 3
   - **M** — R$ 50 — estoque 0 (esgotada)
   - **G** — R$ 60 — estoque 2 (preço diferente)
2. Abrir o produto no storefront
3. Confirmar:
   - 3 chips visíveis, M com line-through e disabled
   - Selecionar G → preço atualiza pra R$ 60
   - `+` sobe até 2 e trava
   - Adicionar à sacola
   - Voltar, selecionar P, adicionar → 2 linhas no drawer
   - Finalizar pelo WhatsApp → mensagem inclui "(P)" e "(G)"
4. Em `/admin/pedidos/[id]`, ver `variantNameSnapshot` correto

**Se algum item falhar**, reportar no chat antes de seguir pra Onda 2.

---

## 🟡 Próxima onda — Onda 2 (Backend SQL hardening, ~3h)

Fluxo de execução:

```powershell
cd "C:\Users\ANDERSON FELIPE\Documents\catalogo"
git status   # confirmar branch limpa

# Passo 1: rodar PROMPT 4 sozinho (regulariza migration 0004)
git checkout -b hardening/regularize-drizzle
# abrir chat novo, colar Prompt 4 (abaixo)
# após terminar: git checkout master && git merge hardening/regularize-drizzle

# Passo 2: rodar PROMPT 5 e PROMPT 6 em PARALELO (chats separados)
# - Prompt 5: indexes + FK safety + CHECK constraints
# - Prompt 6: cron expire-orders + reposição de estoque
# Zero overlap de arquivos

# Passo 3: após ambos voltarem
npm test && npm run lint && npm run build
git log --oneline
```

### 📋 Prompt 4 — Regularizar migration 0004 (~30min, SOZINHO primeiro)

**Por que sozinho**: mexe em `drizzle/meta/_journal.json`. Qualquer migration que outro prompt gere depois conflita.

**Prompt completo**: ver seção "Prompt 4" no histórico do chat principal, OU recriar a partir do template:

> Trabalho sênior, sem pressa, com cabeça fria — é cirurgia em ferramenta de migration.
>
> Contexto: Vitrê em `C:\Users\ANDERSON FELIPE\Documents\catalogo`. Leia CLAUDE.md.
>
> Bug: `drizzle/0004_public_order_token_stock_hardening.sql` foi criada manualmente fora do `drizzle-kit generate`. Não está em `drizzle/meta/_journal.json` nem tem `0004_snapshot.json`. Próximo `db:generate` vai conflitar. Adicionalmente, `supabase/sql/04_product_image_position_unique.sql` cria UNIQUE no DB que não está declarado em `src/db/schema/catalog.ts`.
>
> Trabalho:
> 1. Auditar estado atual (`_journal.json`, `0003_snapshot.json`, schema TS).
> 2. Decidir entre OPÇÃO A (regenerar via drizzle-kit) ou OPÇÃO B (costurar journal manualmente). Reportar antes de aplicar.
> 3. Declarar UNIQUE `(product_id, position)` em `productImageTable` no schema TS, com nome bate-DB.
> 4. Confirmar que `publicToken` UNIQUE NOT NULL e `store.ownerId` UNIQUE estão declarados.
> 5. Validar: `npm run db:generate` retorna "no changes"; testes 39/39; lint zero; build OK.
>
> Use agent `code-reviewer` no final. Commit em PT-BR. Reporte opção escolhida e drift residual.

### 📋 Prompt 5 — Indexes + FK safety + CHECK constraints (~1h)

**Após Prompt 4 mergeado**. Pode rodar em paralelo com Prompt 6.

> Trabalho sênior, idempotente — SQL pra produção. Cada CREATE/ALTER seguro pra rodar 2x.
>
> Contexto: Vitrê em `C:\Users\ANDERSON FELIPE\Documents\catalogo`. Leia CLAUDE.md.
>
> 3 frentes:
>
> **A) Indexes pra escala** — criar `supabase/sql/05_indexes_for_scale.sql` com:
> - `product_store_active_created_idx` partial (is_active=true) em `(store_id, created_at DESC)`
> - `product_featured_active_idx` partial (is_active=true AND is_featured=true)
> - `product_store_category_active_idx` em `(store_id, category_id, created_at DESC)` partial
> - `order_store_created_idx` em `(store_id, created_at DESC)` + DROP do redundante `order_created_idx`
> - `pg_trgm` extension + `product_name_trgm_idx` GIN partial pra busca em escala
>
> **B) FK safety** — criar `supabase/sql/06_fk_safety.sql`:
> - `store.owner_id` ON DELETE CASCADE → RESTRICT
> - `category.parent_id` ON DELETE CASCADE → RESTRICT
> - Atualizar `src/db/schema/store.ts` e `catalog.ts` com `.onDelete("restrict")`
>
> **C) CHECK constraints** — criar `supabase/sql/07_check_constraints.sql` (DO $$ ... $$ block idempotente):
> - `order_item.quantity > 0`
> - `order.total_in_cents >= 0`
> - `product.base_price_in_cents > 0`, `promo_price_in_cents IS NULL OR > 0`
> - `product_variant.price_in_cents IS NULL OR > 0`, `stock_quantity IS NULL OR >= 0`
> - `product.stock_quantity IS NULL OR >= 0`
> - `position >= 0` em category, banner, product_image
>
> ANTES de gravar SQL, AUDITAR nomes reais de tabelas/colunas em `src/db/schema/*.ts` (snake_case vs camelCase) e nomes reais das constraints (via `pg_constraint`). Não inventar.
>
> ANTES de aplicar CHECKs, rodar SELECT count(*) WHERE violando — corrigir dado pré-existente.
>
> Aplicar via `npm run db:apply` ou similar. Validar: `db:check`, `db:generate` sem drift, smoke `INSERT inválido → falha`, `EXPLAIN` confirma uso dos novos indexes, testes 39/39.
>
> Commits separados (1 por SQL + 1 schema TS). Agent `code-reviewer` no final.

### 📋 Prompt 6 — Cron expire-orders + reposição de estoque (~1-2h)

**Em paralelo com Prompt 5**. Zero overlap.

> Trabalho sênior, transacional, TDD-first — mexe em estoque e status. Erro vira inconsistência financeira.
>
> Contexto: Vitrê em `C:\Users\ANDERSON FELIPE\Documents\catalogo`. Leia CLAUDE.md.
>
> Bug: `expiresAt = now() + 14d` é setado em todo pedido `awaiting_whatsapp`, mas nenhum cron consome. Pedido abandonado fica permanentemente bloqueando estoque. `update-status.ts` muda status mas NÃO repõe estoque (descoberta do Chat 1).
>
> Trabalho:
>
> 1. Criar `src/lib/order/restock.ts` com `restockOrderItems(tx, orderId, storeId)`. Espelhar lógica de decremento em `create-from-cart.ts:336-383`: variant primeiro (se trackeia), fallback produto. Defesa em profundidade via WHERE storeId.
>
> 2. Tests RED em `tests/restock.test.ts`: 5 cenários (produto sem variante / variante / produto sem stock track / multi-item / storeId errado).
>
> 3. Atualizar `src/actions/order/update-status.ts`: chamar `restockOrderItems` em transição `awaiting_whatsapp|confirmed → canceled`. **NÃO** em `fulfilled → canceled` (cliente já tem o produto). Respeitar matriz de transições válidas existente.
>
> 4. Criar `src/app/api/cron/expire-orders/route.ts`:
>    - Auth `Bearer ${env.CRON_SECRET}` com `crypto.timingSafeEqual`
>    - SELECT pedidos `WHERE status='awaiting_whatsapp' AND expires_at < now()` JOIN store pra storeSlug
>    - Loop com transações INDEPENDENTES por pedido (uma falha não derruba batch)
>    - Cada transação: restock + UPDATE status='expired' com optimistic lock (`WHERE status='awaiting_whatsapp'`)
>    - `revalidateTag(\`store-${slug}\`)` por loja afetada (não 1× por pedido)
>    - Resposta JSON: `{ ok, at, expired, errors, storesTouched }`
>
> 5. Atualizar `vercel.json` com cron `0 6 * * *` (06:00 UTC, separado do keep-alive).
>
> 6. Tests pro cron: auth 401, batch vazio, 1 expirado, confirmed expirado é IGNORADO, multi-loja revalida múltiplos tags, falha mid-transaction continua batch.
>
> Smoke manual: inserir pedido com `expires_at = now() - 1h`, `curl -H "Authorization: Bearer <CRON_SECRET>" localhost:3000/api/cron/expire-orders`, confirmar status='expired' E estoque reposto.
>
> Commits separados (lib + update-status + cron+vercel.json). Agent `code-reviewer` no final.

---

## 🔮 Onda 3 (futura, antes do segundo lojista pago)

**RLS real** — single big batch (~1 dia):
- Criar role Postgres `app_tenant` não-superuser
- Migrar `DATABASE_URL` pra essa role
- `ALTER TABLE … FORCE ROW LEVEL SECURITY` em todas as 8 tabelas de domínio
- Padronizar `withTenant` em 100% das ~30 server actions (hoje só 2 usam)
- Lint rule banindo `import { db }` em `src/actions/**`
- Atualizar ADR-0001 com o estado real

Não bloqueia Sandra (1 lojista). **Bloqueia o segundo lojista pago.**

Prompt detalhado a ser gerado quando chegar a hora — peça no chat principal.

---

## 🚀 Como retomar do zero (após reiniciar o PC)

1. Abrir VS Code em `C:\Users\ANDERSON FELIPE\Documents\catalogo`
2. Abrir terminal: `git status` (confirmar limpa) + `git log --oneline -5`
3. Abrir este arquivo (`proximo.md`)
4. Ler seção "Onde estamos" + "Smoke tests pendentes"
5. Se smoke tests **NÃO** foram feitos: rodar `npm run dev` e fazer agora
6. Se smoke tests **OK**: seguir pra Onda 2 (Prompt 4 sozinho primeiro)
7. No Claude Code (chat novo aqui no VS Code): mande algo como:

   > Continue de onde paramos. Leia `proximo.md` e a memória.

   Eu vou ler memória + este arquivo, dar status, e te perguntar se já fez os smoke tests / qual prompt da Onda 2 mandar primeiro.

---

## 📚 Referências

- **Auditoria base**: `lapidamento.md` (raiz)
- **ADRs recentes**: `docs/decisoes/0010-...md`, `docs/decisoes/0011-...md`
- **Estado de fase**: `docs/CONTEXT.md` (Fase 1.6 concluída, 1.7 deploy pendente)
- **Convenções**: `CLAUDE.md` (raiz)
- **Esse arquivo**: pode ser apagado ou renomeado quando Onda 2 e 3 fecharem.
