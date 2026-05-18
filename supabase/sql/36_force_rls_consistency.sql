-- =====================================================================
-- 36_force_rls_consistency.sql — FORCE ROW LEVEL SECURITY consistency
-- (renomeado de 27_* em 2026-05-18 para resolver colisão com 27_pdv_surcharge_check.sql)
-- =====================================================================
--
-- CONTEXTO
-- --------
-- Auditoria 2026-05-18 detectou inconsistência: 3 tabelas têm RLS
-- habilitado mas SEM `FORCE`, diferente de todas as outras tabelas de
-- domínio (banner, category, order, order_item, product, product_image,
-- product_variant, store — todas `force=true`).
--
-- Tabelas afetadas:
--   - customer        (Fase 3 — ADR-0014)
--   - product_related (Onda 4 — 2026-05-13)
--   - stock_movement  (Fase 4 — ADR-0015)
--
-- IMPACTO DE `FORCE`
-- ------------------
-- Sem FORCE, o role dono da tabela bypassa RLS por default (Postgres
-- behavior). FORCE garante que mesmo o owner role respeita as policies.
-- Em produção o app usa `vitre_app` role (já RLS-enforced via SQL 09),
-- então o impacto operacional é zero — mas fecha defesa em profundidade
-- contra escalation de privilégio em qualquer caminho que conecte como
-- owner (scripts, migrations, hotfixes manuais).
--
-- IDEMPOTENTE: `FORCE ROW LEVEL SECURITY` é estado idempotente. Pode
-- rodar quantas vezes quiser.
--
-- COMO RODAR
-- ----------
-- Supabase Dashboard → SQL Editor → cole tudo → Run.
-- =====================================================================

BEGIN;

ALTER TABLE public.customer        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_related FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movement  FORCE ROW LEVEL SECURITY;

COMMIT;

-- Verificação (opcional, rode separado):
-- SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public'
--    AND c.relname IN ('customer', 'product_related', 'stock_movement');
