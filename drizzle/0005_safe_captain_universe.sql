-- =====================================================================
-- 0005 — FK safety + drop de index redundante (gerado por drizzle-kit,
-- adaptado pra idempotência igual aos hardenings 03/04).
--
-- Mudanças:
--   1. category.parent_id   ON DELETE CASCADE → RESTRICT
--   2. store.owner_id       ON DELETE CASCADE → RESTRICT
--   3. drop "order_created_idx" (substituído por composto em sql/05)
--
-- Em prod, o trabalho já foi aplicado via supabase/sql/06_fk_safety.sql
-- e supabase/sql/05_indexes_for_scale.sql antes desta migration ser
-- registrada. Os DO blocks deixam tudo idempotente: re-execução = no-op.
-- =====================================================================

-- 1) category.parent_id → category.id : CASCADE → RESTRICT
DO $$
DECLARE
  v_deltype char;
BEGIN
  SELECT confdeltype INTO v_deltype
    FROM pg_constraint
   WHERE conname = 'category_parent_id_category_id_fk'
     AND conrelid = '"category"'::regclass;

  IF v_deltype = 'c' THEN
    ALTER TABLE "category" DROP CONSTRAINT "category_parent_id_category_id_fk";
    ALTER TABLE "category"
      ADD CONSTRAINT "category_parent_id_category_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;
--> statement-breakpoint

-- 2) store.owner_id → user.id : CASCADE → RESTRICT
DO $$
DECLARE
  v_deltype char;
BEGIN
  SELECT confdeltype INTO v_deltype
    FROM pg_constraint
   WHERE conname = 'store_owner_id_user_id_fk'
     AND conrelid = '"store"'::regclass;

  IF v_deltype = 'c' THEN
    ALTER TABLE "store" DROP CONSTRAINT "store_owner_id_user_id_fk";
    ALTER TABLE "store"
      ADD CONSTRAINT "store_owner_id_user_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;
--> statement-breakpoint

-- 3) drop "order_created_idx" (substituído por composto em sql/05)
DROP INDEX IF EXISTS "order_created_idx";
