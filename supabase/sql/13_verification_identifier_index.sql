-- =====================================================================
-- Vitrê — index em verification.identifier (Better Auth performance)
-- =====================================================================
-- Better Auth faz lookups em `verification` por `identifier` (e-mail)
-- durante reset password, e-mail verification e magic-link. Sem index,
-- é seq scan — small table hoje, mas no fluxo crítico de login.
--
-- Execução:
--   `npm run db:apply -- supabase/sql/13_verification_identifier_index.sql`
-- Idempotente via IF NOT EXISTS.
-- =====================================================================

CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");
