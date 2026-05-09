-- =====================================================================
-- Vitrê — FK safety: troca CASCADE por RESTRICT em deletes catastróficos
-- =====================================================================
-- Mudanças:
--   1. store.owner_id → user.id     CASCADE → RESTRICT
--      (deletar user apagaria a loja inteira; força revisar antes)
--   2. category.parent_id → category.id  CASCADE → RESTRICT
--      (deletar categoria-pai apagaria filhas; força tratamento explícito)
--
-- Constraints reais (audit em pg_constraint, 2026-05-09):
--   - store_owner_id_user_id_fk          (store.owner_id → user.id)
--   - category_parent_id_category_id_fk  (category.parent_id → category.id)
--
-- Idempotência: cada bloco DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT em
-- DO block, checando confdeltype atual antes de mexer.
--
-- Source of truth dual: SQL aqui + .references({ onDelete: "restrict" })
-- nos schemas TS (catalog.ts, store.ts) — drizzle-kit captura `onDelete`
-- de FKs corretamente, então drift fica em zero após próximo db:generate.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) store.owner_id → user.id   ON DELETE RESTRICT
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_deltype char;
BEGIN
  SELECT confdeltype INTO v_deltype
    FROM pg_constraint
   WHERE conname = 'store_owner_id_user_id_fk'
     AND conrelid = '"store"'::regclass;

  -- Só recria se ainda for CASCADE ('c'). 'r' = RESTRICT (já feito).
  IF v_deltype = 'c' THEN
    ALTER TABLE "store"
      DROP CONSTRAINT "store_owner_id_user_id_fk";

    ALTER TABLE "store"
      ADD CONSTRAINT "store_owner_id_user_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "user"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2) category.parent_id → category.id   ON DELETE RESTRICT
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_deltype char;
BEGIN
  SELECT confdeltype INTO v_deltype
    FROM pg_constraint
   WHERE conname = 'category_parent_id_category_id_fk'
     AND conrelid = '"category"'::regclass;

  IF v_deltype = 'c' THEN
    ALTER TABLE "category"
      DROP CONSTRAINT "category_parent_id_category_id_fk";

    ALTER TABLE "category"
      ADD CONSTRAINT "category_parent_id_category_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "category"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;
