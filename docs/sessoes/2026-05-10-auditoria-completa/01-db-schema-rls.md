# Auditoria DB — Schema, Migrations, RLS e Storage

**Data:** 2026-05-10
**Escopo:** read-only. Banco prod (Supabase `zwbkzkyunbmoihcbeztm`), schema Drizzle (`src/db/schema/*.ts`), migrations (`drizzle/*.sql`), SQL versionado (`supabase/sql/*.sql`), tenant helpers (`src/lib/tenant.ts`), DB clients (`src/db/index.ts`), scripts (`scripts/*`).
**Auditor:** sênior DBA/backend
**Premissa:** o cleanup de 2026-05-10 (drop `banner.linked_category_slug` + resync de 9 entries no `__drizzle_migrations`) foi aplicado com sucesso. SQL `09` e `10` ainda **não** foram aplicados em prod (estão à espera do Vercel env swap).

---

## Resumo executivo

1. **Bug crítico em `src/app/sitemap.ts`** — chama `withServiceRole` mas usa o `db` global (RLS pool `vitre_app`) dentro do callback em vez do `tx` recebido. Hoje funciona porque a app ainda roda com role `postgres` (BYPASSRLS); no instante em que o Vercel apontar `DATABASE_URL` para `vitre_app` e `10_force_rls_with_check.sql` for aplicado, o sitemap retorna **zero entries**. O `expire-orders` cron está correto e usa `tx`. **Linha 30, 48, 55, 61.**
2. **`scripts/db-check-storage.ts` desalinhado com SQL** — `02_storage_buckets.sql` cria 4 buckets (`store-logos`, `store-banners`, `product-images`, `category-images`); script de verificação só espera 3. Script reportará `category-images` como "não esperado" (silencioso) e/ou falsamente OK se algum dos 3 estiver presente. **Linha 15.**
3. **`slug-uniqueness.ts` tem fallback inseguro pós-FORCE-RLS** — quando `client` não é passado, default = `db` (sem GUC). Hoje todo caller passa `tx`, mas o tipo do parâmetro deixa o fallback como armadilha futura. Após FORCE RLS, query sem GUC retorna lista vazia → função retorna `base` mesmo se já existir → INSERT bate UNIQUE constraint e quebra com erro genérico. **Linha 32.**
4. **Idempotency de `order` tem dual-shape em prod** — `03_order_idempotency.sql` (manual) cria UNIQUE INDEX, `0003_demonic_vapor.sql` cria CONSTRAINT (idempotente). Em prod pode estar como INDEX ou CONSTRAINT. Funcionalmente equivalentes, mas snapshot Drizzle 0008 só descreve a CONSTRAINT — `db:generate --check` pode futuramente flagar drift se for INDEX. **Risco baixo, dívida técnica.**
5. **Sem index direto em `expires_at`** — cron `expire-orders` faz `WHERE status = 'awaiting_whatsapp' AND expires_at < now()`. Tem `order_status_idx (store_id, status)` que ajuda, mas não cobre `expires_at`. Em volume escala isso vira full scan dentro do bucket "awaiting_whatsapp" de cada loja.

---

## Achados por severidade

### 🔴 Crítico

#### C-1. `sitemap.ts` quebra silenciosamente após FORCE RLS

- **Arquivo:** `src/app/sitemap.ts:29-72`
- **Descrição:** `withServiceRole(reason, async (tx) => { ... })` é chamado, mas o callback ignora `tx` e usa o `db` importado de `@/db` (linha 15). `db` é o pool RLS-bound (`vitre_app`, NOBYPASSRLS após swap). Sem GUC `app.current_store_id` setado e com FORCE RLS ativado, **todas** as 3 queries (stores ativas, products, categories cross-tenant) retornam zero linhas. Resultado: sitemap só devolve a entry da home raíz, sem nenhuma loja, perdendo SEO.
- **Evidência:**
  ```ts
  // src/app/sitemap.ts:15
  import { db } from "@/db";
  // ...
  return withServiceRole("...", async () => {
    const stores = await db.select(...).from(storeTable)...;
    const [products, categories] = await Promise.all([
      db.select(...)...,
      db.select(...)...,
    ]);
  });
  ```
- **Por que crítico:** A intenção do `withServiceRole` é exatamente cobrir esse caso cross-tenant; usar `db` no lugar de `tx` torna o helper inútil. `expire-orders/route.ts:79-93` está correto (usa `tx`), comprovando que o padrão certo existe — só falha aqui.
- **Correção:**
  ```ts
  return withServiceRole("...", async (tx) => {
    const stores = await tx.select(...).from(storeTable)...;
    const [products, categories] = await Promise.all([
      tx.select(...)...,
      tx.select(...)...,
    ]);
  });
  ```
- **Reversibilidade:** trivial. Diff de 3 ocorrências de `db` → `tx` dentro do callback.

#### C-2. `slug-uniqueness.ts` tem fallback `client = db` que vira armadilha pós-FORCE-RLS

- **Arquivo:** `src/lib/slug-uniqueness.ts:32`
- **Descrição:** Default param `client = db` vinha do tempo em que `db` ainda usava role `postgres` (BYPASSRLS). Após Onda C, qualquer caller que esquecer de passar `client: tx` faz uma query sem GUC, sob FORCE RLS, devolvendo `taken = []`. Função retorna `base` como livre, INSERT bate UNIQUE `(store_id, slug)` e quebra com erro genérico só na hora do commit.
- **Evidência:** linha 32: `const { storeId, name, excludeProductId, client = db } = params;`
- **Por que crítico:** silencioso. Hoje todos os 2 callsites (`product/update.ts:137`, e provável `product/create-draft.ts`) passam `client: tx`. Mas é uma porta aberta para regressão.
- **Correção:** tornar `client` obrigatório (remove `= db`) e remover o `import { db }` da linha 3. Tipo do param vira `Tx` (não opcional). Compilador força todos os callers a passar.
- **Reversibilidade:** segura (TS catch pega callers).

#### C-3. Migration journal hashes podem voltar a desalinhar

- **Arquivo:** `scripts/db-cleanup.mjs:25-29` + `drizzle/meta/_journal.json`
- **Descrição:** O cleanup de 2026-05-10 calcula hash com `SHA256( arquivo.sql em LF )` e popula `__drizzle_migrations`. Se em algum branch o git checkout normalizar para CRLF (em Windows com `core.autocrlf=true`) ou se um editor reescrever o arquivo .sql, o hash recalculado por `drizzle-kit migrate` diverge — Drizzle vai reaplicar uma migration tida como aplicada. Migrations 0003-0005 são todas idempotentes, então re-aplicar é no-op, mas as *futuras* (0009+) podem não ser.
- **Evidência:** o memo `db-migrations-discipline` documenta o algoritmo SHA256 LF; o cleanup script aplica isso, mas Drizzle internamente também recalcula no migrate. Não há `.gitattributes` em `drizzle/` para travar EOL.
- **Correção:** adicionar a `.gitattributes`:
  ```
  drizzle/*.sql text eol=lf
  drizzle/meta/*.json text eol=lf
  ```
  E rodar `npm run db:audit` (se existir) ou um spot-check via `node -e "..." | sha256sum` no CI antes de cada `db:migrate`.
- **Reversibilidade:** trivial.

---

### 🟠 Alto

#### A-1. `02_storage_buckets.sql` cria 4 buckets, `check-storage.ts` espera 3

- **Arquivos:**
  - `supabase/sql/02_storage_buckets.sql:23-32` (cria `store-logos`, `store-banners`, `product-images`, **`category-images`**)
  - `scripts/check-storage.ts:15` (`EXPECTED_BUCKETS = ["store-logos", "store-banners", "product-images"]`)
- **Descrição:** Drift entre source-of-truth (SQL) e verificador. Script vai dizer "✅ Todos os 3 buckets esperados estão presentes" mesmo com `category-images` ausente.
- **Por que alto:** se o operador rodou versões antigas do SQL, `category-images` pode literalmente não existir em prod. CRUD de categoria que espera upload vai falhar em runtime.
- **Correção:** sincronizar EXPECTED_BUCKETS pra 4 itens. Validar via `npm run db:check-storage` em prod.
- **Reversibilidade:** segura.

#### A-2. Sem policy de WRITE em `storage.objects` para `vitre_app`

- **Arquivo:** `supabase/sql/02_storage_buckets.sql:84-87`
- **Descrição:** O comentário diz "escrita feita APENAS pelo service_role do Vitrê em server actions". Mas o role usado pela app pós-Onda C é `vitre_app` (NOBYPASSRLS), não service_role. `storage.objects` tem RLS habilitado por padrão e nenhuma policy concede INSERT/UPDATE/DELETE pra `vitre_app`. Resultado: server actions que fazem upload via `@supabase/supabase-js` com a chave service_role ainda funcionam (bypass total). Mas se algum caller usar a connection Postgres direta (drizzle) pra mexer em `storage.objects`, falha.
- **Verificação:** `Grep "storage.objects"` no código retornou só os SQL files — app não toca direto no schema `storage`, usa `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY`. Confirmar essa premissa.
- **Por que alto:** essa decisão depende de uma env var implícita (`SUPABASE_SERVICE_ROLE_KEY`) que precisa estar populada em Vercel. Se faltar, upload silenciosamente cai pra anon e quebra.
- **Correção:** documentar explicitamente em CLAUDE.md ou `09_app_role_setup.sql` que uploads usam Supabase service_role key, não a connection Drizzle. Adicionar check no boot.

#### A-3. Index para `expire-orders` cron é subótimo

- **Arquivo:** `supabase/sql/05_indexes_for_scale.sql` (não cobre) + `src/db/schema/order.ts:69-71`
- **Descrição:** Cron varre `WHERE status = 'awaiting_whatsapp' AND expires_at < now()` cross-tenant. Único index relevante hoje é `order_status_idx (store_id, status)` — Postgres precisa pegar todas as lojas com pedidos awaiting e fazer filter em `expires_at`.
- **Correção sugerida:**
  ```sql
  -- supabase/sql/11_expire_orders_index.sql (criar)
  CREATE INDEX IF NOT EXISTS order_expires_awaiting_idx
    ON "order" (expires_at)
    WHERE status = 'awaiting_whatsapp';
  ```
  Index parcial em `expires_at` filtrado por `status`. Cobre o cron com 1 seek + range scan.
- **Reversibilidade:** segura, idempotente, low-cost (só awaiting_whatsapp).
- **Severidade alto** porque vai virar HOT path em volume e o tempo de cron afeta janela de stock-restock.

#### A-4. `order_anonymous_insert` permite anon inserir order sem `customer_phone` válido a nível de DB

- **Arquivo:** `src/db/schema/order.ts:55` + `supabase/sql/01_rls_setup.sql:119-124`
- **Descrição:** `customer_phone text NOT NULL` (E.164) — mas não há CHECK que valide formato. Zod no boundary valida (libphonenumber-js), porém defesa em profundidade não cobre. SQL manual ou injection que escape o boundary pode gravar lixo. Mesmo padrão para `customer_name`, `whatsapp_number` (E.164 em store).
- **Correção sugerida:**
  ```sql
  ALTER TABLE "order"
    ADD CONSTRAINT order_customer_phone_e164_check
    CHECK (customer_phone ~ '^\+[1-9][0-9]{6,14}$');
  ALTER TABLE store
    ADD CONSTRAINT store_whatsapp_e164_check
    CHECK (whatsapp_number ~ '^\+[1-9][0-9]{6,14}$');
  ```
- **Severidade alto** por ser tabela de PII (LGPD).

#### A-5. `verification` (Better Auth) sem index em `identifier`

- **Arquivo:** `src/db/schema/auth.ts:56-63`
- **Descrição:** Better Auth faz lookups em `verification` por `identifier` (e-mail) durante reset password e e-mail verification. Sem index, é seq scan. Pequena tabela hoje, mas em escala isso vira gargalo síncrono em fluxo de login crítico.
- **Correção:** index `verification_identifier_idx` no schema TS + migration.

#### A-6. `accountTable.password` armazena hash mas sem CHECK de tamanho mínimo

- **Arquivo:** `src/db/schema/auth.ts:51`
- **Descrição:** Better Auth grava bcrypt hash (~60 chars) — campo `text` aceita NULL ou string vazia. Se um caller errado fizer UPDATE direto com `''`, fica autenticável com qualquer senha. Improvável (Better Auth gerencia), mas defesa em profundidade.
- **Correção:** `CHECK (password IS NULL OR length(password) >= 50)`.
- **Severidade alto** se exploit possível.

---

### 🟡 Médio

#### M-1. `customer_notes` em `order` sem limite de tamanho

- **Arquivo:** `src/db/schema/order.ts:56`
- **Descrição:** `text` aceita qualquer tamanho. Atacante pode encher pedido com payload de MB e estourar Vercel logs/Resend webhook. Zod no boundary deveria limitar (verificar `actions/order/schema.ts`).
- **Correção:** adicionar `CHECK (length(customer_notes) <= 2000)` no DB.

#### M-2. `productTable.description` default `''` viola lógica "default vazio é forma legítima"

- **Arquivo:** `src/db/schema/catalog.ts:96`
- **Descrição:** Mistura de UX confuso — `description text NOT NULL DEFAULT ''` permite string vazia mas força NOT NULL. Sem CHECK garantindo que produto publicado (`is_active = true`) tenha descrição. Coerente com a regra atual ("rascunho pode ser vazio") mas inconsistente com `08_check_constraints_conditional_pricing.sql` que JÁ adota essa filosofia para preço.
- **Correção opcional (alinhar policy):**
  ```sql
  CHECK (is_active = false OR length(description) >= 10)
  ```
- **Reversibilidade:** alto risco de quebrar produtos legados. Aplicar só após cleanup manual.

#### M-3. `productImageTable.url` aceita qualquer string

- **Arquivo:** `src/db/schema/catalog.ts:153`
- **Descrição:** sem CHECK que limite a HTTPS Supabase (`supabase.co/storage/...`). Caller malicioso pode gravar URL externa (XSS via `<img src>`). Hoje só server actions inserem após upload via service_role — mas defesa em profundidade.
- **Correção:**
  ```sql
  CHECK (url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/')
  ```
- **Severidade média.** Storefront usa `next/image` que mitiga.

#### M-4. `expiresAt` em `order` sem default; INSERT sem `expiresAt` causa NOT NULL violation

- **Arquivo:** `src/db/schema/order.ts:64`
- **Descrição:** `expiresAt: timestamp("expires_at").notNull()` sem default. Caller deve sempre setar (`now() + 14d`). Risco se caller futuro esquecer — INSERT crash com erro genérico. Aceitável mas vale documentar/policy.
- **Correção:** opcional `default(sql\`now() + interval '14 days'\`)` — assume default de 14d como invariante.

#### M-5. `category.parent_id` permite tree de 3+ níveis a nível de DB

- **Arquivo:** `src/db/schema/catalog.ts:39-41`
- **Descrição:** Schema permite recursão arbitrária. App valida 2 níveis no Zod, mas DB não. Mutação direta SQL pode criar tree profunda → frontend quebra ou loops.
- **Correção:** trigger BEFORE INSERT/UPDATE que rejeita se `parent_id` aponta pra categoria que já tem `parent_id IS NOT NULL`:
  ```sql
  CREATE OR REPLACE FUNCTION enforce_category_max_depth()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.parent_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM category WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Categoria não pode ter avô (max 2 níveis)';
        END IF;
        IF NEW.parent_id = NEW.id THEN
          RAISE EXCEPTION 'Categoria não pode ser pai de si mesma';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  CREATE TRIGGER category_max_depth_trigger
    BEFORE INSERT OR UPDATE ON category
    FOR EACH ROW EXECUTE FUNCTION enforce_category_max_depth();
  ```

#### M-6. Snapshot 0008 espera CONSTRAINT, prod pode ter UNIQUE INDEX (idempotency_key)

- **Arquivos:** `drizzle/0003_demonic_vapor.sql:34-49` + `supabase/sql/03_order_idempotency.sql:25-26`
- **Descrição:** O hardening 0003 cria `order_store_idempotency_unique` como CONSTRAINT *só se não existir* nem como CONSTRAINT nem como INDEX. Em prod, o SQL manual original criou UNIQUE INDEX (`CREATE UNIQUE INDEX IF NOT EXISTS`). Funcionalmente equivalentes, mas o snapshot 0008 (`drizzle/meta/0008_snapshot.json:1354`) declara CONSTRAINT.
- **Por que médio:** próximo `db:generate` em ambiente novo cria CONSTRAINT; futuro `--check` pode flagar drift contra prod.
- **Correção:** rodar SQL manual em prod pra unificar (drop INDEX, create CONSTRAINT) ou aceitar e deixar comentário em 0003.

#### M-7. RLS policy pública em `category` e `product_variant` por `is_active = true` mas não checa `store.is_active`

- **Arquivo:** `supabase/sql/01_rls_setup.sql:54-57, 93-96`
- **Descrição:** Storefront público pode ler `category` ativa de loja **inativa**. Categoria órfã exposta. Mesmo para variants. `store_public_read_active` filtra a `store` em si, mas não cascateia.
- **Correção:**
  ```sql
  DROP POLICY IF EXISTS category_public_read_active ON category;
  CREATE POLICY category_public_read_active ON category
    FOR SELECT
    USING (
      is_active = true
      AND EXISTS (SELECT 1 FROM store s WHERE s.id = category.store_id AND s.is_active = true)
    );
  ```
  Idem para `product`, `product_variant`, `banner`, `product_image`.
- **Reversibilidade:** segura, mas adiciona EXISTS subquery em todo SELECT público — verificar plan via EXPLAIN. Como `store_id` é PK lookup, custo é desprezível.

#### M-8. `relations.ts` mencionado em comentário não existe

- **Arquivo:** `src/db/schema/store.ts:78`
- **Descrição:** comentário diz "Relations declaradas em src/db/schema/relations.ts" — arquivo não existe; relations vivem em `store.ts` linha 79+ e `catalog.ts` etc. Comentário stale.
- **Correção:** remover comentário ou criar o arquivo de fato.

#### M-9. `order_public_mark_whatsapp_opened` usa GUC `app.current_user_id = 'anonymous'` mas a coluna sendo modificada não é restringida

- **Arquivo:** `supabase/sql/10_force_rls_with_check.sql:96-101`
- **Descrição:** Policy diz "anônimo pode UPDATE" — mas a USING/WITH CHECK não limita *quais colunas* podem mudar. Anon com knowledge do publicToken poderia fazer `UPDATE "order" SET status = 'fulfilled' WHERE public_token = $1`. App não faz isso (app valida via server action), mas RLS sozinho não previne.
- **Por que médio:** a defesa é a app + opacidade do publicToken. Mas a doc diz "Restrito a esse campo apenas — qualquer outro UPDATE bate em order_tenant_isolation" — não é verdade. Policy `FOR UPDATE` permite update full-row.
- **Correção:** Postgres não tem column-level RLS. Alternativas:
  1. Trigger BEFORE UPDATE que `RAISE` se qualquer coluna além de `whatsapp_opened_at` mudou quando `current_user_id = 'anonymous'`.
  2. Aceitar e documentar como "1ª linha = app server action".
  3. Mover update via stored function `mark_whatsapp_opened(token text)` com `SECURITY DEFINER`.

---

### 🔵 Baixo

#### B-1. Pool size discrepância docstring

- **Arquivo:** `src/db/index.ts:42-45, 49-52`
- **Descrição:** Comentário do header e CLAUDE.md falam em pool com `max: 1` — atual é `max: 10`. CLAUDE.md outdated.
- **Correção:** atualizar CLAUDE.md.

#### B-2. Sem `application_name` no connection string

- **Arquivo:** `src/db/index.ts`
- **Descrição:** Sem `?application_name=vitre_app` na URL, todas as conexões aparecem genéricas em `pg_stat_activity`. Dificulta debug de slow queries.
- **Correção:** anexar `?application_name=vitre-web` (ou `vitre-cron`) — útil para Supabase dashboard.

#### B-3. Sem statement_timeout configurado

- **Arquivo:** `src/db/index.ts`
- **Descrição:** Sem timeout, query lenta segura connection serverless até timeout do Vercel (10-60s). Causa falhas em chain.
- **Correção:** após ABRIR conexão, executar `SET statement_timeout = '15s'` ou via connection-string `options=-c%20statement_timeout%3D15s`. Ou no helper `withTenant` via `tx.execute`.

#### B-4. `desktop.ini` no repo

- **Arquivo:** `desktop.ini` (raiz)
- **Descrição:** arquivo de metadados do Windows. Não é DB-related mas é lixo no repo.
- **Correção:** adicionar a `.gitignore`.

#### B-5. `framer-motion` ainda em deps

- **Arquivo:** `package.json:31`
- **Descrição:** team memory `dep-removal-spot-check-mandatory` registra que framer-motion foi removido em limpeza 2026-05-09. Voltou? Verificar.
- **Não é DB.**

#### B-6. `imageUrl` em category sem index

- **Arquivo:** `src/db/schema/catalog.ts:44`
- **Descrição:** Coluna informacional, sem caso de uso WHERE. OK.

#### B-7. Migrations 0006, 0007, 0008 não são idempotentes

- **Arquivos:** `drizzle/0006_freezing_mongu.sql`, `0007_peaceful_krista_starr.sql`, `0008_next_professor_monster.sql`
- **Descrição:** São output direto do drizzle-kit (sem `IF NOT EXISTS`). Re-aplicação manual em prod (sem journal) quebra. Hoje OK porque journal está sincronizado, mas próximo cleanup precisa ser cauteloso.
- **Correção opcional:** retroativamente envolver com `IF NOT EXISTS` (introduz ruído, baixo valor).

#### B-8. `niche` enum não tem `roupa_masculina` nem `acessorio`

- **Arquivo:** `src/db/schema/store.ts:19-25`
- **Descrição:** wedge atual é roupa_feminina/joia/semijoia/perfumaria. "outro" cobre. Quando adicionar nichos, requires migration nova (ALTER TYPE ADD VALUE) — fica documentar no roadmap.

#### B-9. `accountTable.refresh_token`, `id_token`, `access_token` sem encryption-at-rest custom

- **Arquivo:** `src/db/schema/auth.ts:45-48`
- **Descrição:** Tokens OAuth gravados em plain text. Better Auth não cifra. Supabase tem disk encryption mas DBA com leitura tem acesso. Pra Google OAuth específico, são tokens curta validade — risco baixo. Documentar.

---

## Drift schema↔migrations↔produção

### Coluna por coluna (TS schema vs snapshot 0008)

| Tabela | TS schema | 0008 snapshot | Prod (presumido) | Drift |
| --- | --- | --- | --- | --- |
| `store` | 24 cols | 24 cols (incl `bottom_nav_style`) | mesmo | nenhum |
| `category` | 9 cols (incl `parent_id`, `image_url`) | mesmo | mesmo | nenhum |
| `product` | 16 cols (com 4 meta canvas-v1) | mesmo | mesmo | nenhum |
| `product_image` | 7 cols | mesmo | mesmo | nenhum |
| `product_variant` | 13 cols (com `axis`, `color_hex`) | mesmo | mesmo | nenhum |
| `banner` | 11 cols (com 5 editoriais canvas-v1) | mesmo | (post-cleanup, sem `linked_category_slug`) | nenhum |
| `order` | 14 cols (incl `public_token`, `idempotency_key`) | mesmo | mesmo | nenhum |
| `order_item` | 10 cols | mesmo | mesmo | nenhum |
| auth tables | match | match | match | nenhum |

### FK / onDelete

| Constraint | TS | Migration | Esperado em prod | Status |
| --- | --- | --- | --- | --- |
| `store.owner_id → user.id` | RESTRICT | 0000=CASCADE → 0005 (idemp) corrige pra RESTRICT | RESTRICT (06_fk_safety aplicado) | OK |
| `category.parent_id → category.id` | RESTRICT | 0002=CASCADE → 0005 (idemp) corrige | RESTRICT | OK |
| `product.category_id → category.id` | SET NULL | 0000=SET NULL | SET NULL | OK |
| `product.store_id → store.id` | CASCADE | 0000=CASCADE | CASCADE | OK |
| `order.store_id → store.id` | CASCADE | 0000=CASCADE | CASCADE | OK |
| `order_item.order_id → order.id` | CASCADE | 0000=CASCADE | CASCADE | OK |

**Atenção:** `order_item.order_id ON DELETE CASCADE` significa que deletar `order` apaga itens. Pedido ANTIGO (concluído) sendo apagado destruiria o histórico imutável. Hoje o app não deleta order — só transita status para `canceled` ou `expired`. Mas a porta está aberta. Considerar mudar para RESTRICT pós-MVP.

### Indexes

| Index | TS declarado | SQL versionado | Prod | Status |
| --- | --- | --- | --- | --- |
| Indexes simples (`product_store_idx`, etc.) | sim (0000) | — | sim | OK |
| `product_store_active_created_idx` (parcial) | não (Drizzle não captura) | sim (05) | sim | OK (não-drift) |
| `product_featured_active_idx` (parcial) | não | sim (05) | sim | OK |
| `product_store_category_active_idx` (parcial) | não | sim (05) | sim | OK |
| `order_store_created_idx` | não | sim (05) | sim | OK |
| `order_created_idx` (legacy) | dropado | sim (05 drop, 0005 drop também) | dropado | OK |
| `product_name_trgm_idx` (GIN) | não | sim (05) | sim | OK |
| `order_expires_awaiting_idx` (sugerido) | não | **NÃO EXISTE** | — | **A-3 acima** |

### CHECK constraints

| Constraint | SQL versionado | Prod | Tem em TS? |
| --- | --- | --- | --- |
| `order_item_quantity_check` | 07 | sim | não (Drizzle 0.45 limita) |
| `order_total_in_cents_check` | 07 | sim | não |
| `product_base_price_in_cents_check` | 07→08 (`is_active OR > 0`) | 08 ativo | não |
| `product_promo_price_in_cents_check` | 07→08 (`NULL OR > 0`) | 08 ativo | não |
| `product_variant_price_in_cents_check` | 07→08 (`NULL OR > 0`) | 08 ativo | não |
| `product_variant_stock_quantity_check` | 07 (`NULL OR >= 0`) | sim | não |
| `product_stock_quantity_check` | 07 (`NULL OR >= 0`) | sim | não |
| `category_position_check` | 07 (`>= 0`) | sim | não |
| `banner_position_check` | 07 (`>= 0`) | sim | não |
| `product_image_position_check` | 07 (`>= 0`) | sim | não |

**Faltando** (M-1, A-4):

- `order_customer_phone_e164_check`
- `store_whatsapp_e164_check`
- `customer_notes_length_check`
- `product_image_url_supabase_only_check`

### RLS policies

| Tabela | Policy admin (FOR ALL) | Policy pública (FOR SELECT) | FORCE RLS | WITH CHECK |
| --- | --- | --- | --- | --- |
| `store` | `store_owner_access` (owner_id) | `store_public_read_active` (is_active=true) | sim (após 10) | sim (após 10) |
| `category` | `category_tenant_isolation` | `category_public_read_active` | sim | sim |
| `product` | `product_tenant_isolation` | `product_public_read_active` | sim | sim |
| `product_image` | `product_image_tenant_isolation` | `product_image_public_read` (USING true) | sim | sim |
| `product_variant` | `variant_tenant_isolation` | `variant_public_read_active` | sim | sim |
| `banner` | `banner_tenant_isolation` | `banner_public_read_active` | sim | sim |
| `order` | `order_tenant_isolation` + `order_anonymous_insert` (INSERT) + `order_public_mark_whatsapp_opened` (UPDATE anon) | (sem) | sim | sim |
| `order_item` | `order_item_tenant_access` (via EXISTS subquery) | (sem) | sim | sim |
| auth tables | RLS DISABLED | — | — | — |

**Findings:**
- M-7 acima: cascata `is_active` não cobre store inativa para filhos.
- M-9 acima: `order_public_mark_whatsapp_opened` é over-permissive a nível de coluna.
- `product_image_public_read USING(true)` — qualquer um lê toda imagem mesmo de loja inativa/produto inativo. Provavelmente consciente (CDN), mas vale revisar.

### Pendências (memória `auditoria-2026-05-09-pendencias-criticas`)

- ✅ SQL 01-09 aplicados em prod conforme memória.
- ❌ **SQL 10** ainda não aplicado (depende do swap `vitre_app` no Vercel). Confirmar.
- ❌ Vercel `DATABASE_URL` ainda usa role `postgres` (BYPASSRLS) — confirmar.

---

## Connection pool e performance

- `db` (`vitre_app` via 6543 PgBouncer transaction mode): `Pool({ max: 10 })`. Em Vercel serverless, cada lambda spawna seu próprio pool — total real depende de paralelismo. PgBouncer no Supabase Free aguenta ~15 connections totais. **Risco médio sob spike**: tirar `max: 10` ou subir `max: 1` por lambda.
- `serviceDb` (`postgres` via 5432 session mode): mesmo `max: 10`. Session mode não tem PgBouncer — **cada serviceDb conn é uma conn real Postgres**. Em Supabase Free temos ~60 conns total (15 reservadas para Supabase). 10 por lambda × N lambdas = saturação rápida.
- **Sem `statement_timeout`** (B-3).
- **Sem `application_name`** (B-2).
- Migrations usam DIRECT_URL (drizzle.config.ts:12) ✅
- App usa DATABASE_URL (env.ts implícito) ✅

---

## Idempotency e race conditions

- **`order_store_idempotency_unique`**: ✅ funciona (M-6 é cosmético).
- **CASCADE em `order_item`**: 🟠 alto se app começar a deletar order — proteger via CHECK de status.
- **Sem optimistic locks** (`version` column) em produto, store, category. A app raramente tem multi-edit simultâneo (1 lojista por loja MVP), então OK por ora.
- **Race condition em slug uniqueness**: o `generateUniqueProductSlug` pode ser concorrente — entre `select` e `insert`, outro request pode pegar o mesmo slug+sufixo. UNIQUE constraint pega no DB, mas erro retornado é genérico. Aceitável.
- **Cron `expire-orders` optimistic UPDATE**: ✅ correto (`AND status = 'awaiting_whatsapp'`).

---

## PII e secrets

- **PII em `order`**: `customer_name`, `customer_phone`, `customer_notes`. Sem encryption-at-rest custom (Supabase disk encryption only). LGPD: documentar política de retenção. Sugestão: cron de purge de pedidos `expired` ou `fulfilled` > 12 meses (anonimização).
- **`__VITRE_APP_PASSWORD__` placeholder**: ✅ não substituído por senha real no repo (verificado via grep).
- **Tokens OAuth em `account`**: B-9 acima.
- **Service role key**: assumido em env Vercel; não está no repo.

---

## Storage Supabase

- 4 buckets esperados em SQL, 3 em check script (A-1).
- Policies de SELECT criadas via DO blocks idempotentes para 4 buckets ✅.
- Sem policy de INSERT/UPDATE/DELETE — escrita via service_role key (assumido, A-2).
- Limite 4MB / WebP only ✅.

---

## Migration discipline

- 9 entries no journal, 9 arquivos `.sql` em `drizzle/` ✅
- Hashes alinhados pós-cleanup 2026-05-10 ✅ (script preservado em `scripts/db-cleanup.mjs`)
- **Risco futuro**: EOL drift (C-3). Adicionar `.gitattributes`.
- Migrations 0003-0005 idempotentes (DO blocks); 0000-0002, 0006-0008 NÃO são idempotentes (B-7).
- **Order**: 0000 → 0001 (parent_id col) → 0002 (parent_id FK CASCADE) → 0003 (image_url + idempotency_key) → 0004 (public_token + UNIQUEs) → 0005 (FK fix CASCADE → RESTRICT, drop legacy index) → 0006 (bottom_nav_style) → 0007 (banner editorial) → 0008 (variant_axis enum + color_hex + product meta).

### SQLs em `supabase/sql/` aplicados em prod

Status conforme memória `auditoria-2026-05-09-pendencias-criticas`:

| SQL | Aplicado | Notas |
| --- | --- | --- |
| 01_rls_setup | sim | substituído pelas policies de 10 |
| 02_storage_buckets | sim | (verificar 4 buckets via A-1) |
| 03_order_idempotency | sim (manual) | consolidado em 0003 |
| 04_product_image_position_unique | sim | consolidado em 0004 |
| 05_indexes_for_scale | sim | source-of-truth fica aqui |
| 06_fk_safety | sim | reflete em 0005 |
| 07_check_constraints | sim | substituído por 08 nos 3 preços |
| 08_check_constraints_conditional_pricing | sim | OK |
| 09_app_role_setup | **a confirmar** | depende de senha real |
| 10_force_rls_with_check | **NÃO** | aguarda swap Vercel |

---

## Plano de reset DB (caso founder opte por wipe + re-apply)

Se houver decisão de "começar do zero" (sem dados de Sandra Brito relevantes), passos seguros, na ordem:

1. **Backup**:
   ```bash
   pg_dump $DIRECT_URL --schema=public --schema=storage --no-owner > backup-$(date +%Y%m%d).sql
   ```

2. **Drop schema público** (via Supabase SQL Editor com user postgres):
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
   ```

3. **Reset journal Drizzle**:
   ```sql
   DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
   ```

4. **Re-aplicar migrations Drizzle**:
   ```bash
   npm run db:migrate    # aplica 0000-0008 em sequência
   ```

5. **Aplicar SQLs versionados** (na ordem):
   ```bash
   npm run db:apply -- supabase/sql/01_rls_setup.sql
   npm run db:apply -- supabase/sql/02_storage_buckets.sql
   # 03 e 04 já estão em 0003/0004 — pular
   npm run db:apply -- supabase/sql/05_indexes_for_scale.sql
   # 06 já está em 0005 — pular
   npm run db:apply -- supabase/sql/07_check_constraints.sql
   npm run db:apply -- supabase/sql/08_check_constraints_conditional_pricing.sql
   ```

6. **Setup role `vitre_app`**:
   - Substitui `__VITRE_APP_PASSWORD__` em 09 por senha real (não comitar).
   - `npm run db:apply -- supabase/sql/09_app_role_setup.sql`
   - Atualizar `DATABASE_URL` no Vercel: `vitre_app.<project_ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
   - `DIRECT_URL` continua com `postgres`.

7. **FORCE RLS** (lock the door):
   ```bash
   npm run db:apply -- supabase/sql/10_force_rls_with_check.sql
   ```

8. **Validações**:
   ```bash
   npm run db:check
   npm run db:check-storage   # após corrigir A-1
   ```
   Verificar `pg_policies`, `relrowsecurity=t`, `relforcerowsecurity=t`, e `vitre_app.rolbypassrls=false`.

9. **Re-seed cliente piloto**:
   ```bash
   npm run db:seed   # se script existir; caso contrário, signup via UI + import manual
   ```

10. **Smoke test**:
    - signup novo usuário → criar loja → criar produto com imagem → criar order via storefront → confirmar `revalidateTag` ativa.
    - Tentar query cross-tenant via psql como `vitre_app` SEM GUC → esperado: 0 rows.
    - Tentar query como `postgres` (DIRECT_URL) → esperado: tudo visível (BYPASSRLS).

**Dados residuais a observar antes do wipe:**
- Sandra Brito Collection (cliente piloto). Decidir se preserva.
- Banner Sandra com ID `933da21b-e87a-4c24-86d0-a4353baa2e44` (referenciado em `seed-sandra-banner.cjs`).
- Conta lojista da Sandra em `user`/`account`.

Se preservar, fazer dump filtrado por `store_id = '<sandra>'` antes de step 2.

---

## Conclusão

**Estado atual:** sólido para MVP em produção pequena (1 cliente piloto). Os achados 🔴 são todos *latentes* — só explodem quando SQL 10 + Vercel env swap forem aplicados.

**Bloqueadores antes de Onda C ir live:**
1. Corrigir `sitemap.ts` (C-1).
2. Tornar `client` obrigatório em `slug-uniqueness.ts` (C-2).
3. Adicionar `category-images` ao `check-storage.ts` (A-1) e validar bucket existe.
4. Adicionar index `order_expires_awaiting_idx` (A-3) — barato, idempotente.
5. Confirmar `SUPABASE_SERVICE_ROLE_KEY` está populada no Vercel (A-2).

**Bloqueador independente:**
- `.gitattributes` para EOL (C-3) — antes de qualquer próximo `db:generate`.

**Dívida técnica recomendada (próxima sprint):**
- A-4 (CHECK E.164), A-5 (index verification.identifier), A-6 (CHECK password length), M-5 (trigger anti-3-níveis), M-7 (cascata is_active em filhas).

Tudo o resto é polimento.
