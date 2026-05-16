-- =====================================================================
-- Vitrê — CHECK constraints para `stock_movement` (Fase 4 / ADR-0015)
-- =====================================================================
-- Aplicar manualmente no Editor do Supabase APÓS rodar `pnpm db:migrate`
-- que aplica `0017_military_hitman.sql`.
--
-- Garantias:
--   - quantity_delta != 0 (movimento de zero não tem semântica útil)
--   - reference_type/reference_id são consistentes (ambos NULL ou ambos
--     setados com type em ('order','manual'); na Fase 5 (PDV) ALTER pra
--     incluir 'balcao')
--   - notes <= 500 chars
--
-- Idempotente: DROP IF EXISTS + IF NOT EXISTS guarded.
-- =====================================================================

ALTER TABLE "stock_movement"
  DROP CONSTRAINT IF EXISTS "stock_movement_delta_nonzero";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_movement_delta_nonzero'
       AND conrelid = '"stock_movement"'::regclass
  ) THEN
    ALTER TABLE "stock_movement"
      ADD CONSTRAINT "stock_movement_delta_nonzero"
      CHECK ("quantity_delta" <> 0);
  END IF;
END $$;

ALTER TABLE "stock_movement"
  DROP CONSTRAINT IF EXISTS "stock_movement_reference_consistency";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_movement_reference_consistency'
       AND conrelid = '"stock_movement"'::regclass
  ) THEN
    ALTER TABLE "stock_movement"
      ADD CONSTRAINT "stock_movement_reference_consistency"
      CHECK (
        ("reference_type" IS NULL AND "reference_id" IS NULL)
        OR ("reference_type" IN ('order', 'manual') AND "reference_id" IS NOT NULL)
      );
  END IF;
END $$;

ALTER TABLE "stock_movement"
  DROP CONSTRAINT IF EXISTS "stock_movement_notes_length";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_movement_notes_length'
       AND conrelid = '"stock_movement"'::regclass
  ) THEN
    ALTER TABLE "stock_movement"
      ADD CONSTRAINT "stock_movement_notes_length"
      CHECK ("notes" IS NULL OR char_length("notes") <= 500);
  END IF;
END $$;
