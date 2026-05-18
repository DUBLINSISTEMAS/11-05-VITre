-- ADR-0026 — Cupons
-- CHECK constraints + RLS FORCE.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_discount_value_range') THEN
    -- percentage: 1..9999 bps · fixed: >= 1 cent
    ALTER TABLE coupon ADD CONSTRAINT coupon_discount_value_range
      CHECK (
        (discount_type = 'percentage' AND discount_value >= 1 AND discount_value <= 9999)
        OR (discount_type = 'fixed' AND discount_value >= 1)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_uses_count_nonneg') THEN
    ALTER TABLE coupon ADD CONSTRAINT coupon_uses_count_nonneg CHECK (uses_count >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_max_uses_positive') THEN
    ALTER TABLE coupon ADD CONSTRAINT coupon_max_uses_positive
      CHECK (max_uses IS NULL OR max_uses >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_date_range_consistent') THEN
    ALTER TABLE coupon ADD CONSTRAINT coupon_date_range_consistent
      CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at);
  END IF;
END $$;

ALTER TABLE "coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupon" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupon_tenant_isolation ON "coupon";
CREATE POLICY coupon_tenant_isolation ON "coupon"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
