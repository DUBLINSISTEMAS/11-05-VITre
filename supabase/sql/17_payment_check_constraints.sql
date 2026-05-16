-- =====================================================================
-- 17_payment_check_constraints.sql  (Fase 2 — ADR-0013)
-- =====================================================================
-- CHECK constraints pras colunas de pagamento configurável adicionadas
-- em drizzle/0014_amused_captain_flint.sql.
--
-- Cobre superfície que Zod no app cobre, mas:
--   - Zod só protege o caminho feliz (server actions).
--   - DB blinda contra tampering, raw SQL e migração futura defeituosa.
--   - Sem isso, lojista poderia salvar cardMaxInstallments=999 via
--     tampering de form e o front renderiza "999× de R$ 0,10".
--
-- Aplicar manualmente pelo Editor do Supabase, seguindo runbook dos
-- SQLs 11-16. Atualizar scripts/check-sql-applied.mjs depois pra
-- registrar SQL 17 como aplicado.
-- =====================================================================

ALTER TABLE "store"
  ADD CONSTRAINT "store_card_max_installments_range"
    CHECK ("card_max_installments" BETWEEN 1 AND 12),
  ADD CONSTRAINT "store_card_interest_rate_bps_range"
    CHECK ("card_interest_rate_bps" BETWEEN 0 AND 9999),
  ADD CONSTRAINT "store_cash_discount_bps_range"
    CHECK ("cash_discount_bps" BETWEEN 0 AND 9999),
  ADD CONSTRAINT "store_payment_methods_note_length"
    CHECK (
      "payment_methods_note" IS NULL
      OR char_length("payment_methods_note") <= 280
    );

ALTER TABLE "product"
  ADD CONSTRAINT "product_installments_override_range"
    CHECK (
      "installments_override" IS NULL
      OR "installments_override" BETWEEN 1 AND 12
    );
