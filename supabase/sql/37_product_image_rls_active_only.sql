-- =====================================================================
-- 37_product_image_rls_active_only.sql
-- =====================================================================
-- Aplicar via Supabase SQL Editor (out-of-band, ordem após 36).
--
-- CONTEXTO
-- --------
-- Auditoria sênior 2026-05-18 (C4): a policy original
-- `product_image_public_read` em supabase/sql/01_rls_setup.sql usa
-- `USING (true)` — o que permite anon enumerar URLs de imagens de
-- produtos INATIVOS / drafts via supabase-js. Inconsistente com a
-- política equivalente em `product` (`product_public_read_active`) que
-- exige `is_active = true`.
--
-- FIX: trocar `USING (true)` por subselect ligado ao produto pai.
-- Embora o bucket Storage seja público, RLS na tabela espelha a
-- visibilidade do produto.
--
-- IDEMPOTENTE: DROP POLICY IF EXISTS + CREATE POLICY (Postgres não tem
-- CREATE OR REPLACE POLICY).
--
-- COMO RODAR
-- ----------
-- Supabase Dashboard → SQL Editor → cole tudo → Run.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "product_image_public_read"        ON public.product_image;
DROP POLICY IF EXISTS "product_image_public_read_active" ON public.product_image;

CREATE POLICY "product_image_public_read_active"
  ON public.product_image
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.product p
       WHERE p.id = product_image.product_id
         AND p.is_active = true
    )
  );

COMMIT;

-- Verificação manual:
-- SELECT polname, polroles::regrole[], pg_get_expr(polqual, polrelid)
--   FROM pg_policy
--  WHERE polrelid = 'public.product_image'::regclass
--    AND polname LIKE 'product_image_public_read%';
