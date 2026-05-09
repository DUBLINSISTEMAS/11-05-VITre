-- =====================================================================
-- Vitrê — Onda C / Step 1: criar role `vitre_app` para a aplicação
-- =====================================================================
-- Por quê:
--   Hoje a conexão Drizzle (DATABASE_URL) usa role `postgres` (superuser),
--   que ignora RLS. Resultado: todas policies em 01_rls_setup.sql funcionam
--   apenas como teatro defensivo. Criar uma role dedicada SEM `BYPASSRLS`
--   ativa a 2ª linha de defesa prometida em ADR-0001 e CLAUDE.md §1.
--
-- Como aplicar:
--   1. Defina uma senha forte (≥ 16 chars, sem aspas) para a role:
--        export VITRE_APP_DB_PASSWORD='troque-isto-por-algo-forte'
--   2. Abra Supabase Dashboard → SQL Editor → cole este arquivo,
--      substitua `__VITRE_APP_PASSWORD__` pela senha real, → Run.
--   3. No painel Vercel (e no `.env.local`), troque a parte de credenciais
--      do `DATABASE_URL` por `vitre_app:<senha>@...`. Mantenha o mesmo host
--      (pooler do Supabase) e mesma database. NÃO alterar `DIRECT_URL` —
--      ela continua com `postgres` para `db:migrate`/`db:push` aplicarem
--      DDL.
--   4. Depois, aplicar 10_force_rls_with_check.sql.
--
-- Idempotente: roda quantas vezes for preciso (DROP/CREATE-IF-NOT-EXISTS).
--
-- Referências:
--   docs/decisoes/0001-multi-tenant-rls-postgres.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Criar role (idempotente)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vitre_app') THEN
    CREATE ROLE vitre_app
      WITH LOGIN
           NOSUPERUSER
           NOCREATEDB
           NOCREATEROLE
           NOBYPASSRLS
           PASSWORD '__VITRE_APP_PASSWORD__';
  ELSE
    -- Garante que flags continuem corretas mesmo se role pré-existia.
    ALTER ROLE vitre_app
      WITH LOGIN
           NOSUPERUSER
           NOCREATEDB
           NOCREATEROLE
           NOBYPASSRLS;
  END IF;
END $$;

-- Senha pode ser rotacionada depois (rode esta linha isoladamente):
-- ALTER ROLE vitre_app WITH PASSWORD '__VITRE_APP_PASSWORD__';

-- ---------------------------------------------------------------------
-- 2. GRANTs no schema public — DML em tabelas de domínio + auth tables
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO vitre_app;

-- Tabelas de domínio (FORCE RLS será aplicado em 10_*).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  store,
  category,
  product,
  product_image,
  product_variant,
  banner,
  "order",
  order_item
  TO vitre_app;

-- Tabelas Better Auth (RLS desabilitada via 01_*; framework gerencia segurança).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "user",
  session,
  account,
  verification
  TO vitre_app;

-- Sequences (Drizzle uuid v4 não usa, mas Better Auth e migrations futuras podem).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vitre_app;

-- DEFAULT PRIVILEGES — qualquer tabela/sequence FUTURA criada por `postgres`
-- já nasce com permissão pra `vitre_app`. Evita esquecer GRANT em migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vitre_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vitre_app;

-- ---------------------------------------------------------------------
-- 3. Verificação rápida — rode após apply
-- ---------------------------------------------------------------------
-- SELECT rolname, rolbypassrls, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'vitre_app';
-- Esperado: rolbypassrls=false, rolsuper=false, rolcanlogin=true.
