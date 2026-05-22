-- =====================================================================
-- Mangos Pay — CHECK constraints para PDV / venda balcão (Fase 5 / ADR-0016)
-- =====================================================================
-- Aplicar APÓS rodar `pnpm db:migrate` que aplica 0018_yielding_earthquake.sql
-- (enums order_channel/order_payment_method + colunas channel/payment_method/
-- discount_in_cents/cash_received_in_cents + nullable em customer_phone/expires_at).
--
-- Garantias:
--   1. channel='balcao' EXIGE payment_method NOT NULL — sem isso, venda
--      balcão fica sem método registrado e relatório de caixa quebra.
--   2. discount_in_cents nunca negativo (acréscimo NÃO é desconto).
--   3. cash_received_in_cents só faz sentido com payment_method='cash' E
--      >= total_in_cents (não dá pra dar troco de valor menor que o total).
--   4. channel='whatsapp' NÃO pode ter cash_received nem discount manual —
--      desconto à vista de WhatsApp é via `cash_discount_bps` da loja
--      (Fase 2), aplicado dinamicamente; storefront não tem campo "troco".
--
-- Idempotente: DROP IF EXISTS + IF NOT EXISTS guarded.
-- Aplicar via: pnpm exec tsx scripts/apply-sql.ts supabase/sql/26_pdv_check_constraints.sql
-- =====================================================================

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_balcao_requires_payment_method";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_balcao_requires_payment_method'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_balcao_requires_payment_method"
      CHECK (
        channel <> 'balcao' OR payment_method IS NOT NULL
      );
  END IF;
END $$;

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_discount_nonneg";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_discount_nonneg'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_discount_nonneg"
      CHECK (
        discount_in_cents IS NULL OR discount_in_cents >= 0
      );
  END IF;
END $$;

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_cash_received_consistency";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_cash_received_consistency'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_cash_received_consistency"
      CHECK (
        cash_received_in_cents IS NULL
        OR (
          payment_method = 'cash'
          AND cash_received_in_cents >= total_in_cents
        )
      );
  END IF;
END $$;

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_whatsapp_no_pos_fields";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_whatsapp_no_pos_fields'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_whatsapp_no_pos_fields"
      CHECK (
        channel <> 'whatsapp'
        OR (
          cash_received_in_cents IS NULL
          AND discount_in_cents IS NULL
          AND payment_method IS NULL
        )
      );
  END IF;
END $$;
