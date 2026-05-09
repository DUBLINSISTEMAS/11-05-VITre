-- =====================================================================
-- Vitrê — idempotency_key em order
-- =====================================================================
-- ⚠️ CONSOLIDADO em drizzle/0003_demonic_vapor.sql
-- (coluna + UNIQUE declarados em src/db/schema/order.ts).
--
-- Este arquivo é mantido apenas como REGISTRO HISTÓRICO da aplicação
-- manual feita em produção antes da regularização do journal Drizzle.
-- NÃO precisa ser executado em ambientes novos — drizzle-kit migrate
-- aplica via 0003 (idempotente).
--
-- Documentação: docs/decisoes/0010-carrinho-checkout-whatsapp-flow.md
-- =====================================================================

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE "order"
   SET idempotency_key = gen_random_uuid()::text
 WHERE idempotency_key IS NULL;

ALTER TABLE "order"
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_store_idempotency_unique
  ON "order" (store_id, idempotency_key);
