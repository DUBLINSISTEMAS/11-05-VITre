-- =====================================================================
-- Vitre - Revogar grants de roles publicas do Supabase
-- =====================================================================
-- Contexto:
--   Supabase cria GRANTS default de SELECT/INSERT/UPDATE/DELETE para as
--   roles `anon` e `authenticated` em tabelas do schema `public`. Como as
--   tabelas Better Auth (user, session, account, verification) tem RLS
--   DESABILITADA (Better Auth gerencia seguranca internamente via vitre_app
--   + cookies assinados), `anon` consegue ler/escrever direto via
--   supabase-js + anon key. A anon key fica no bundle publico por design da
--   plataforma.
--
--   Sem este script, qualquer pessoa com acesso ao bundle pode listar emails
--   de lojistas, contar sessions ativas, deletar verifications, etc.
--
-- Por que e seguro revogar:
--   - A aplicacao usa role `vitre_app` (DATABASE_URL via PgBouncer).
--   - Storage do Supabase usa policies separadas no schema `storage`
--     (configuradas em 02_storage_buckets.sql); este revoke no schema
--     `public` nao afeta Storage.
--   - `anon` e `authenticated` nao sao consumidas em nenhum fluxo Vitre.
--   - PostgREST (backend do supabase-js) deixa de responder para essas roles
--     em tabelas public, que e o comportamento desejado.
--
-- Idempotente. Roda multiplas vezes sem efeito acumulado.
--
-- Verificacao pos-apply:
--   pnpm db:check-anon
--   O script tenta SELECT nessas tabelas via anon key e passa quando todas
--   retornam permission denied.
-- =====================================================================

-- ============================================================
-- A. REVOGAR tudo de anon/authenticated em todas tabelas public
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- ============================================================
-- B. Garantir que NOVAS tabelas (futuras migrations) tambem sao
--    bloqueadas por default. Sem isso, uma migration futura pode reabrir
--    o vetor no momento do CREATE TABLE.
-- ============================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ============================================================
-- C. Verificacao - esperado zero linhas
-- ============================================================
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated');
-- Esperado: 0 rows.

-- ============================================================
-- D. Sanity check - vitre_app continua com acesso a 12+ tabelas.
-- ============================================================
SELECT grantee, COUNT(DISTINCT table_name) AS table_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'vitre_app'
GROUP BY grantee;
-- Esperado: vitre_app | 12 (ou mais conforme migrations futuras).

-- ============================================================
-- E. Nota sobre Storage
-- ============================================================
-- Buckets de Storage usam policies em `storage.objects` (schema `storage`,
-- nao `public`). Estas policies nao sao afetadas pelos REVOKEs acima.
-- 02_storage_buckets.sql continua permitindo:
--   - SELECT publico nos buckets public do Storage (storefront).
--   - Escrita somente via service_role nas server actions do Vitre.
-- ============================================================
