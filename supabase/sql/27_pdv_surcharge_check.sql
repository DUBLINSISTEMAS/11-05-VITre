-- SQL 27 — CHECK constraint surcharge_in_cents >= 0 (ADR-0020).
--
-- Aplicar manualmente no Supabase SQL Editor APÓS rodar a migration
-- Drizzle 0019_pdv_surcharge.sql (que adiciona a coluna).
--
-- order_total_nonneg já existe via SQL 26 (ADR-0016) — total_in_cents
-- já é validado >= 0; surcharge entra nessa equação via aplicação
-- (total = subtotal - discount + surcharge), garantindo coerência.

ALTER TABLE "order"
  ADD CONSTRAINT IF NOT EXISTS order_surcharge_nonneg
  CHECK (surcharge_in_cents IS NULL OR surcharge_in_cents >= 0);

-- Verificação:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'order_surcharge_nonneg';
