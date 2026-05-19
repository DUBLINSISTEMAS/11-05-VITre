-- =====================================================================
-- 38_pdv_whatsapp_surcharge_check.sql
-- =====================================================================
-- Aplicar via Supabase SQL Editor (out-of-band, ordem após 37).
--
-- CONTEXTO
-- --------
-- Auditoria sênior 2026-05-18 (C5): o CHECK `order_whatsapp_no_pos_fields`
-- (criado em supabase/sql/26_pdv_check_constraints.sql) só restringe
-- `cash_received_in_cents`, `discount_in_cents` e `payment_method` para
-- canal WhatsApp. O campo `surcharge_in_cents` (adicionado por
-- drizzle/0019_pdv_surcharge.sql + SQL 27, ADR-0020) ficou de fora —
-- DB aceita order WhatsApp com surcharge, o que é incoerente com a
-- semântica POS-only do acréscimo (taxa cartão, embalagem, frete).
--
-- FIX: redefinir o CHECK incluindo `surcharge_in_cents IS NULL`.
--
-- IDEMPOTENTE: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT direto.
-- (Postgres não suporta IF NOT EXISTS em ADD CONSTRAINT — pattern memory
-- `postgres-add-constraint-no-if-not-exists`.)
--
-- COMO RODAR
-- ----------
-- Supabase Dashboard → SQL Editor → cole tudo → Run.
-- =====================================================================

BEGIN;

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_whatsapp_no_pos_fields";

ALTER TABLE "order"
  ADD CONSTRAINT "order_whatsapp_no_pos_fields"
  CHECK (
    channel <> 'whatsapp'
    OR (
      cash_received_in_cents IS NULL
      AND discount_in_cents IS NULL
      AND surcharge_in_cents IS NULL
      AND payment_method IS NULL
    )
  );

COMMIT;

-- Verificação manual:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conname = 'order_whatsapp_no_pos_fields';
