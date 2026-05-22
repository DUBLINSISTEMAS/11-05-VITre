-- =====================================================================
-- Mangos Pay — 0003: regulariza idempotency_key + adiciona image_url em category
-- =====================================================================
-- Esta migration consolida:
--   (a) `image_url` em `category` (NOVO — Fase 1.5 storefront)
--   (b) `idempotency_key` em `order` (já aplicado em prod via
--       supabase/sql/03_order_idempotency.sql; aqui é registro formal
--       no histórico Drizzle, idempotente pra não re-aplicar).
--
-- Todas as alterações usam IF NOT EXISTS / DO blocks pra serem
-- idempotentes — segura tanto pra ambientes novos (SQL real) quanto
-- pra ambientes que já receberam os comandos manuais (no-op).
-- =====================================================================

-- (a) Categoria: imagem (Fase 1.5)
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint

-- (b) Order: idempotency_key — same shape do supabase/sql/03_order_idempotency.sql
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint

UPDATE "order"
   SET "idempotency_key" = gen_random_uuid()::text
 WHERE "idempotency_key" IS NULL;
--> statement-breakpoint

ALTER TABLE "order" ALTER COLUMN "idempotency_key" SET NOT NULL;
--> statement-breakpoint

-- UNIQUE — checamos pg_constraint E pg_class porque a aplicação manual
-- criou um UNIQUE INDEX (não constraint) com o mesmo nome. Funcional-
-- mente equivalentes; aqui só garantimos que existe algum dos dois.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_store_idempotency_unique'
      AND conrelid = '"order"'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'order_store_idempotency_unique'
      AND relkind = 'i'
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_store_idempotency_unique"
      UNIQUE ("store_id", "idempotency_key");
  END IF;
END $$;
