-- =====================================================================
-- Vitrê — Constraints + RLS de cash_session/cash_adjustment (ADR-0022)
-- =====================================================================
-- Aplicar APÓS `pnpm db:migrate` que aplica drizzle/0021_cash_session.sql
-- (cria as 2 tabelas + enum + FKs + index composto + ALTER order ADD
-- cash_session_id).
--
-- Cobertura deste arquivo:
--   1. CHECK opening_amount_in_cents >= 0
--   2. CHECK closing_actual_in_cents >= 0
--   3. CHECK closing_expected_in_cents IS NULL OR >= 0 (esperado pode
--      ser zero mas não negativo — sangria > opening + vendas seria erro
--      operacional, mas DB aceita; aplicação valida)
--   4. CHECK cash_adjustment.amount_in_cents > 0 (zero é meaningless)
--   5. CHECK cash_session — closed_at IS NULL → closing_* todos NULL;
--      closed_at NOT NULL → closing_actual_in_cents NOT NULL.
--   6. UNIQUE PARTIAL cash_session_open_per_store WHERE closed_at IS NULL
--      — só UMA sessão aberta por loja (ADR-0022 D2 = não reabre).
--   7. RLS cash_session — tenant isolation pelo GUC app.current_store_id
--   8. RLS cash_adjustment — herda via EXISTS check sobre cash_session
--   9. FORCE ROW LEVEL SECURITY em ambas (convenção pós-cleanup 5e8b90c)
--
-- Idempotente: pattern canônico Vitrê (DROP IF EXISTS / DO $$ IF NOT
-- EXISTS pra constraints; CREATE UNIQUE INDEX IF NOT EXISTS pra index;
-- DROP POLICY IF EXISTS / CREATE POLICY pra RLS).
--
-- Aplicar via: pnpm exec tsx scripts/apply-sql.ts supabase/sql/29_cash_session_constraints.sql
-- =====================================================================

-- ------------ 1. CHECK opening >= 0 ------------
ALTER TABLE "cash_session"
  DROP CONSTRAINT IF EXISTS "cash_session_opening_nonneg";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cash_session_opening_nonneg'
       AND conrelid = '"cash_session"'::regclass
  ) THEN
    ALTER TABLE "cash_session"
      ADD CONSTRAINT "cash_session_opening_nonneg"
      CHECK (opening_amount_in_cents >= 0);
  END IF;
END $$;

-- ------------ 2. CHECK closing_actual >= 0 (quando NOT NULL) ------------
ALTER TABLE "cash_session"
  DROP CONSTRAINT IF EXISTS "cash_session_closing_actual_nonneg";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cash_session_closing_actual_nonneg'
       AND conrelid = '"cash_session"'::regclass
  ) THEN
    ALTER TABLE "cash_session"
      ADD CONSTRAINT "cash_session_closing_actual_nonneg"
      CHECK (closing_actual_in_cents IS NULL OR closing_actual_in_cents >= 0);
  END IF;
END $$;

-- ------------ 3. CHECK closing_expected >= 0 (quando NOT NULL) ------------
ALTER TABLE "cash_session"
  DROP CONSTRAINT IF EXISTS "cash_session_closing_expected_nonneg";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cash_session_closing_expected_nonneg'
       AND conrelid = '"cash_session"'::regclass
  ) THEN
    ALTER TABLE "cash_session"
      ADD CONSTRAINT "cash_session_closing_expected_nonneg"
      CHECK (closing_expected_in_cents IS NULL OR closing_expected_in_cents >= 0);
  END IF;
END $$;

-- ------------ 4. CHECK adjustment.amount > 0 ------------
ALTER TABLE "cash_adjustment"
  DROP CONSTRAINT IF EXISTS "cash_adjustment_amount_positive";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cash_adjustment_amount_positive'
       AND conrelid = '"cash_adjustment"'::regclass
  ) THEN
    ALTER TABLE "cash_adjustment"
      ADD CONSTRAINT "cash_adjustment_amount_positive"
      CHECK (amount_in_cents > 0);
  END IF;
END $$;

-- ------------ 5. CHECK consistência closed_at <-> closing_* ------------
-- Regra: closed_at NULL ⇒ closing_* todos NULL; closed_at NOT NULL ⇒
-- closing_actual NOT NULL (esperado é calculado server-side e SEMPRE
-- preenchido junto; notes só obrigatório em app-layer se diferença ≠ 0).
ALTER TABLE "cash_session"
  DROP CONSTRAINT IF EXISTS "cash_session_closed_consistency";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cash_session_closed_consistency'
       AND conrelid = '"cash_session"'::regclass
  ) THEN
    ALTER TABLE "cash_session"
      ADD CONSTRAINT "cash_session_closed_consistency"
      CHECK (
        (closed_at IS NULL
          AND closed_by_user_id IS NULL
          AND closing_expected_in_cents IS NULL
          AND closing_actual_in_cents IS NULL
          AND closing_notes IS NULL)
        OR
        (closed_at IS NOT NULL
          AND closed_by_user_id IS NOT NULL
          AND closing_expected_in_cents IS NOT NULL
          AND closing_actual_in_cents IS NOT NULL)
      );
  END IF;
END $$;

-- ------------ 6. UNIQUE PARTIAL uma sessão aberta por loja ------------
CREATE UNIQUE INDEX IF NOT EXISTS "cash_session_open_per_store"
  ON "cash_session" (store_id)
  WHERE closed_at IS NULL;

-- ------------ 7. RLS cash_session ------------
ALTER TABLE "cash_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_session" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_session_tenant_isolation ON "cash_session";
CREATE POLICY cash_session_tenant_isolation ON "cash_session"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- ------------ 8. RLS cash_adjustment (herda via cash_session) ------------
-- cash_adjustment NÃO tem store_id direto — herda via JOIN. Policy faz
-- EXISTS na cash_session do mesmo tenant. SELECT/UPDATE/DELETE só vê
-- adjustments de sessões da própria loja. INSERT exige WITH CHECK que
-- a sessão alvo seja da loja atual.
ALTER TABLE "cash_adjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_adjustment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_adjustment_tenant_isolation ON "cash_adjustment";
CREATE POLICY cash_adjustment_tenant_isolation ON "cash_adjustment"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "cash_session" cs
      WHERE cs.id = cash_adjustment.cash_session_id
        AND cs.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "cash_session" cs
      WHERE cs.id = cash_adjustment.cash_session_id
        AND cs.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  );

-- =====================================================================
-- Verificação manual:
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid IN ('"cash_session"'::regclass, '"cash_adjustment"'::regclass)
-- ORDER BY conrelid, conname;
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('cash_session','cash_adjustment')
-- ORDER BY tablename, indexname;
--
-- SELECT schemaname, tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables WHERE tablename IN ('cash_session','cash_adjustment');
--
-- SELECT polname, polrelid::regclass FROM pg_policy
-- WHERE polrelid IN ('"cash_session"'::regclass, '"cash_adjustment"'::regclass);
-- =====================================================================
