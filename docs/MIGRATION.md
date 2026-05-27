# Migrations — Mangos Pay

> Como o schema do DB é gerenciado e o que fazer quando precisar mudá-lo.
> Documento curto. Quando o fluxo mudar, atualizar aqui.

---

## Duas fontes (com motivo)

O projeto usa **duas pastas de schema** em paralelo. Não é bagunça — é decisão consciente.

### `drizzle/*.sql` (gerado)

- Criado automaticamente por `drizzle-kit generate` quando `src/db/schema/**.ts` muda.
- Cobre **estrutura de tabela**: colunas, tipos, NOT NULL, defaults, FKs simples.
- Snapshot incremental em `drizzle/meta/000N_snapshot.json`.
- Nunca editar manualmente.

### `supabase/sql/NN_*.sql` (escrito à mão)

- Tudo que Drizzle não gera bem:
  - **RLS policies** (USING, WITH CHECK, FORCE ROW LEVEL SECURITY)
  - **CHECK constraints** com expressões complexas
  - **Triggers + functions** (sync de cache de estoque, audit forense)
  - **GRANTs** por role (vitre_app vs anon vs postgres)
  - **Indexes especiais** (gin_trgm pra busca, parciais com WHERE, etc)
  - Backfills idempotentes
- Numeração sequencial (`11_*.sql`, `12_*.sql`…). Hoje vai até **81** (cleanup 2026-05-27). O #80 (parked_sale) foi DROPADO no #81 — feature nunca foi entregue UI e founder removeu na auditoria de dead code.
- Cada nova SQL tem 2 obrigações:
  1. **Idempotente** — `IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, `DO $$ ... IF NOT EXISTS THEN ...`. Roda 2× = mesmo resultado.
  2. **Sentinelada** em `scripts/check-sql-applied.mjs` — um SELECT que retorna 1 linha se aplicada.

### Drift intencional documentado

Casos onde Drizzle e supabase/sql cobrem **a mesma feature**:

- `drizzle/0033_order_item_discount.sql` cria a coluna `order_item.discount_in_cents`.
- `supabase/sql/59_order_item_discount.sql` cria os 2 CHECKs (`>=0` e `<= price*qty`).

A coluna é prerequisite do CHECK, então a ordem importa: deploy aplica drizzle primeiro (via `drizzle-kit migrate` ou no painel Supabase) e depois a SQL 59.

---

## Workflow ao mudar schema

1. **Editar `src/db/schema/*.ts`** (adicionar coluna, ajustar tipo, etc).
2. `pnpm exec drizzle-kit generate` — gera nova migration em `drizzle/`.
3. Se precisa de RLS / CHECK / trigger / index especial → criar `supabase/sql/NN_*.sql` com IF NOT EXISTS.
4. **Aplicar em prod** via `DIRECT_URL`:
   ```bash
   node --input-type=module -e "
   import { config } from 'dotenv'; config({ path: '.env.local' });
   const { Pool } = await import('pg');
   const { readFileSync } = await import('node:fs');
   const sql = readFileSync('supabase/sql/NN_*.sql', 'utf8');
   const pool = new Pool({ connectionString: process.env.DIRECT_URL });
   await pool.query(sql);
   await pool.end();
   "
   ```
   `DIRECT_URL` aponta pra role `postgres` (BYPASSRLS, sem pgbouncer) — só ela tem GRANT pra mudar schema.
5. **Estender sentinela** em `scripts/check-sql-applied.mjs`:
   ```js
   { id: "NN", desc: "...", q: "SELECT 1 FROM ..." }
   ```
6. Rodar `node scripts/check-sql-applied.mjs` — esperado `N/N aplicados`.
7. Commitar `drizzle/`, `supabase/sql/NN_*.sql`, schema TS e a sentinela **juntos**.

Regra inquebrável: **toda SQL criada é aplicada na hora.** Sem deixar pendente.

---

## Roles em prod

| Role | Bypass RLS? | Uso |
|---|---|---|
| `postgres` | SIM (BYPASSRLS) | `DIRECT_URL` — migrations + scripts admin |
| `vitre_app` | NÃO (FORCE ROW LEVEL SECURITY) | `DATABASE_URL` — runtime da aplicação |
| `anon` | NÃO | RLS policies específicas (`lead_anon_insert` etc) |

`vitre_app` foi criada por `supabase/sql/09_app_role_setup.sql`. **Não bypassa RLS** — toda query da aplicação passa pelas policies.

---

## Verificação contínua

- **`scripts/check-sql-applied.mjs`** — sentinela read-only. Roda antes de cada deploy crítico. Cobre 11 → 81 (~85 checks). Não cobre `drizzle/0034_email_verified_grandfathering.sql` que fica **deferred até Resend domain + flip `EMAIL_VERIFICATION_REQUIRED=true`** (Bloco 4 da Fase 2). Sequência exigida: (1) Resend domain DKIM/SPF/DMARC → (2) `psql $DIRECT_URL -f drizzle/0034_*.sql` → (3) smoke `/verificar-email` → (4) flip env Vercel → (5) redeploy.
- **`scripts/smoke-idor.mjs`** — smoke manual de cross-tenant SELECT/INSERT/UPDATE. Roda quando mexer em RLS.
- **`RUN_INTEGRATION=1 npm run test:integration`** — 39 testes automatizados contra DB real (role `vitre_app`). Gate pré-merge quando tocar schema / RLS / withTenant.
- **CI hoje só faz unit** (`npm test`). Integration roda local — sem DB ephemeral na pipeline ainda. Defer pra Sprint pós-#1.

---

## SQLs especiais que não têm sentinela

- `17_cleanup_orphan_drafts.sql` + `99_cleanup_orphan_drafts.sql` — one-shot DELETE de produtos draft órfãos. Sem objeto persistente pra checar.
- `25_*` (backfill estoque) — só roda se há produto com `track_stock=true` e saldo > 0. Em DB virgem é no-op. Documentado em `check-sql-applied.mjs`.

---

## Quando uma migration falha em prod

1. **Não rodar de novo cegamente.** Verificar com `psql $DIRECT_URL`:
   ```sql
   -- Constraint já existe?
   SELECT * FROM pg_constraint WHERE conname='nome_da_constraint';
   -- Coluna já existe?
   SELECT * FROM information_schema.columns WHERE table_name='X' AND column_name='Y';
   ```
2. Se half-applied, considerar criar SQL `NN+1_fix_*` que recupera (DROP idempotente + recriar).
3. **Nunca editar SQL já aplicada** — vira nova SQL incremental. Histórico imutável.

---

## Como aprender mais

- `CLAUDE.md` seção "Convenções técnicas obrigatórias" — RLS-first, withTenant, etc.
- `src/lib/tenant.ts` — `withTenant`, `withServiceRole`, `OWNER_SCOPE_SENTINEL`.
- `tests/integration/rls-cross-tenant.test.ts` — 39 cenários de cross-tenant SELECT/INSERT/UPDATE.
