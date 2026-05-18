-- ADR-0025 — Grupos de clientes
-- CHECK: discount_bps 0..9999 (até 99.99%). RLS FORCE tenant_isolation.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_group_discount_bps_range') THEN
    ALTER TABLE customer_group ADD CONSTRAINT customer_group_discount_bps_range
      CHECK (discount_bps >= 0 AND discount_bps <= 9999);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_group_position_nonneg') THEN
    ALTER TABLE customer_group ADD CONSTRAINT customer_group_position_nonneg CHECK (position >= 0);
  END IF;
END $$;

ALTER TABLE "customer_group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_group" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_group_tenant_isolation ON "customer_group";
CREATE POLICY customer_group_tenant_isolation ON "customer_group"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
