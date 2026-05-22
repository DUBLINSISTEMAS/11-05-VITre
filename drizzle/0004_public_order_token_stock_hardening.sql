-- =====================================================================
-- Mangos Pay — 0004: hardening pedido público + invariantes 1 loja/owner +
-- UNIQUE (product_id, position) em product_image
-- =====================================================================
-- Esta migration consolida três mudanças e é IDEMPOTENTE (DO blocks +
-- IF NOT EXISTS). Algumas dessas alterações já foram aplicadas no DB
-- de produção via SQL manual antes da regularização do journal:
--
--   (a) public_token em "order": identificador público opaco para /p/[token].
--       short_code continua humano, mas não deve ser usado como URL pública.
--
--   (b) UNIQUE (owner_id) em "store": invariante MVP de 1 usuário = 1 loja.
--
--   (c) UNIQUE (product_id, position) em product_image: garante que
--       uploads simultâneos pro mesmo produto não colidam na mesma
--       posição. Anteriormente em supabase/sql/04_product_image_position_unique.sql,
--       agora consolidado aqui pra ficar registrado no histórico Drizzle.
--
-- Re-execução em ambientes que já receberam (a)/(b) manualmente é segura:
-- todos os comandos checam pg_constraint/pg_class antes de aplicar.
-- =====================================================================

-- (a) order.public_token --------------------------------------------------
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "public_token" text;
--> statement-breakpoint

UPDATE "order"
   SET "public_token" = translate(
     encode(gen_random_bytes(18), 'base64'),
     '+/',
     '-_'
   )
 WHERE "public_token" IS NULL;
--> statement-breakpoint

ALTER TABLE "order" ALTER COLUMN "public_token" SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_public_token_unique'
      AND conrelid = '"order"'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'order_public_token_unique'
      AND relkind = 'i'
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_public_token_unique" UNIQUE ("public_token");
  END IF;
END $$;
--> statement-breakpoint

-- (b) store.owner_id UNIQUE ----------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_owner_id_unique'
      AND conrelid = 'store'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'store_owner_id_unique'
      AND relkind = 'i'
  ) THEN
    ALTER TABLE "store"
      ADD CONSTRAINT "store_owner_id_unique" UNIQUE ("owner_id");
  END IF;
END $$;
--> statement-breakpoint

-- (c) product_image UNIQUE (product_id, position) -----------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_image_product_position_unique'
      AND conrelid = '"product_image"'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'product_image_product_position_unique'
      AND relkind = 'i'
  ) THEN
    ALTER TABLE "product_image"
      ADD CONSTRAINT "product_image_product_position_unique"
      UNIQUE ("product_id", "position");
  END IF;
END $$;
