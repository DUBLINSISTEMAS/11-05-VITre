-- =============================================================================
-- Limpeza da loja de DEV "dublin-sistemas" antes de virar prod
-- =============================================================================
--
-- O que faz:
--   - Mostra o que vai ser apagado (BEGIN; rollback automático no final)
--   - DELETE FROM store WHERE slug = 'dublin-sistemas' (cascateia tudo via FKs
--     ON DELETE CASCADE — confirmado em scripts/inspect-fks-for-cleanup.mjs)
--
-- O que PRESERVA:
--   - User dublinsistemas@gmail.com (pra você logar como owner em prod)
--   - Sessões better-auth (vão expirar naturalmente)
--   - Conta OAuth se houver
--   - Schema, RLS, policies, triggers — TUDO de estrutura
--
-- O que NÃO toca (precisa de script separado):
--   - Arquivos em supabase Storage (buckets product-images, store-logos,
--     store-banners). Use scripts/wipe-dev-storage.mjs depois.
--
-- =============================================================================
-- COMO USAR
--   1. Rodar este arquivo PRIMEIRO em modo dry-run:
--        cat scripts/wipe-dev-store.sql | psql "$DIRECT_URL"
--      Ele faz BEGIN ... ROLLBACK no final — só mostra o que aconteceria,
--      sem deletar nada de verdade.
--
--   2. Se confortável, mudar a última linha de ROLLBACK pra COMMIT e rodar
--      de novo. OU rodar via npm run db:apply (que aceita .sql arbitrário —
--      ver scripts/apply-sql.ts pra modo "rodar arquivo único").
-- =============================================================================

BEGIN;

-- 1. SNAPSHOT do que existe HOJE
SELECT
  (SELECT count(*) FROM store WHERE slug = 'dublin-sistemas')        AS stores,
  (SELECT count(*) FROM product
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS products,
  (SELECT count(*) FROM "order"
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS orders,
  (SELECT count(*) FROM customer
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS customers,
  (SELECT count(*) FROM receivable
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS receivables,
  (SELECT count(*) FROM cash_session
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS cash_sessions,
  (SELECT count(*) FROM stock_movement
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS movements,
  (SELECT count(*) FROM store_membership
     WHERE store_id IN (SELECT id FROM store WHERE slug = 'dublin-sistemas'))  AS memberships;

-- 2. O delete em cascata
DELETE FROM store WHERE slug = 'dublin-sistemas';

-- 3. CONFIRMA que zerou
SELECT
  (SELECT count(*) FROM store)            AS stores_remaining,
  (SELECT count(*) FROM product)          AS products_remaining,
  (SELECT count(*) FROM "order")          AS orders_remaining,
  (SELECT count(*) FROM customer)         AS customers_remaining,
  (SELECT count(*) FROM receivable)       AS receivables_remaining,
  (SELECT count(*) FROM cash_session)     AS cash_sessions_remaining,
  (SELECT count(*) FROM stock_movement)   AS movements_remaining,
  (SELECT count(*) FROM store_membership) AS memberships_remaining;

-- 4. CONFIRMA que user e sessão sobreviveram
SELECT email, created_at FROM "user" ORDER BY created_at;
SELECT count(*) AS sessions_remaining FROM session;

-- =============================================================================
-- AQUI VOCÊ DECIDE:
--   ROLLBACK = dry-run, mostra os números mas não apaga nada
--   COMMIT   = vale de verdade
-- =============================================================================

-- Default: ROLLBACK (dry-run). Pra apagar de verdade, comente ROLLBACK e
-- descomente COMMIT.
ROLLBACK;
-- COMMIT;
