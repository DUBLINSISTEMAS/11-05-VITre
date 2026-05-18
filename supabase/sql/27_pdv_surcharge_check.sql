-- =====================================================================
-- Vitrê — CHECK constraint surcharge_in_cents >= 0 (ADR-0020)
-- =====================================================================
-- Aplicar APÓS rodar `pnpm db:migrate` que aplica drizzle/0019_pdv_surcharge.sql
-- (adiciona a coluna `surcharge_in_cents integer NULLABLE`).
--
-- Garantia: acréscimo nunca negativo. Acréscimo é simétrico a discount mas
-- diferente em semântica: discount > subtotal é bloqueado em app-layer
-- (DISCOUNT_OVER_TOTAL); surcharge PODE ser qualquer valor positivo (taxa
-- cartão, frete, embalagem). order_total_nonneg (SQL 26) garante que o
-- total final >= 0 — discount nunca pode "levar embora" mais do que tem.
--
-- Idempotente: DROP IF EXISTS + IF NOT EXISTS guarded (pattern do SQL 26).
-- Aplicar via: pnpm exec tsx scripts/apply-sql.ts supabase/sql/27_pdv_surcharge_check.sql
-- =====================================================================

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_surcharge_nonneg";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_surcharge_nonneg'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_surcharge_nonneg"
      CHECK (surcharge_in_cents IS NULL OR surcharge_in_cents >= 0);
  END IF;
END $$;

-- Verificação manual:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'order_surcharge_nonneg';
