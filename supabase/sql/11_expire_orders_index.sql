-- =====================================================================
-- Mangos Pay — index parcial para o cron expire-orders
-- =====================================================================
-- Cron `/api/cron/expire-orders` varre cross-tenant:
--   WHERE status = 'awaiting_whatsapp' AND expires_at < now()
--
-- Sem este index, o planner usa `order_status_idx (store_id, status)` e
-- precisa fazer filter em expires_at — vira full scan dentro do bucket
-- "awaiting_whatsapp" de cada loja. Em volume, custo cresce linear.
--
-- Index parcial: cobre só o subconjunto interessante (awaiting_whatsapp).
-- Tamanho desprezível (a maioria dos pedidos transita rapidamente pra
-- outros status), mas dá seek + range scan exato pro cron.
--
-- Execução:
--   `npm run db:apply -- supabase/sql/11_expire_orders_index.sql`
-- Idempotente via IF NOT EXISTS.
-- =====================================================================

CREATE INDEX IF NOT EXISTS "order_expires_awaiting_idx"
  ON "order" ("expires_at")
  WHERE "status" = 'awaiting_whatsapp';
