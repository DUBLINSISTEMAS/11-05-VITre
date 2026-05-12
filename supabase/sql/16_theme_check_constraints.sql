-- supabase/sql/16_theme_check_constraints.sql
--
-- Defesa em depth: garante na borda do DB que os eixos de tema (Onda C)
-- aceitam apenas valores conhecidos. App-layer (Zod nas actions) é a 1ª
-- camada; este CHECK é a 2ª (proteção contra acesso direto / db:push
-- futuro / migration descuidada).
--
-- Inclui também CHECK retroativo no `bottom_nav_style` (canvas-v1
-- adicionou a coluna sem constraint — dívida que esta migration paga).
--
-- IDEMPOTÊNCIA: usa `DO ... IF NOT EXISTS` via pg_constraint pra poder
-- rodar de novo sem erro. Padrão das demais migrations supabase/sql.
--
-- ROLLBACK seguro: `ALTER TABLE store DROP CONSTRAINT <name>;`
--
-- Aplicação:
--   1. Supabase Dashboard → SQL Editor → cole este arquivo → Run
--   2. OU psql -f supabase/sql/16_theme_check_constraints.sql via DIRECT_URL

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_category_shape_valid'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_category_shape_valid
      CHECK (category_shape IN ('rounded', 'square', 'circle'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_product_card_style_valid'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_product_card_style_valid
      CHECK (product_card_style IN ('standard', 'minimal', 'bold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_hero_style_valid'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_hero_style_valid
      CHECK (hero_style IN ('cover', 'split', 'minimal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_bottom_nav_style_valid'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_bottom_nav_style_valid
      CHECK (bottom_nav_style IN ('pill', 'rule', 'glass'));
  END IF;
END $$;
