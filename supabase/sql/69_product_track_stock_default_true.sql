-- =====================================================================
-- Mangos Pay — Sprint flash (2026-05-24): track_stock default true
-- =====================================================================
-- CONTEXTO
-- Auditoria do founder (nota 4/10) identificou bug de UX silencioso:
-- produto cadastrado nascia com `track_stock=false`. Resultado:
--   - /admin/estoque (tabela snapshot) filtra track_stock=true → produto
--     NÃO aparece
--   - aba "Sem estoque" do listing filtra track_stock=true AND qty=0 →
--     produto NÃO aparece
--   - lojista cadastra 50 SKUs e perde do estoque sem aviso
--
-- ICP do Mangos Pay = varejo físico BR (joia, semijoia, roupa,
-- perfumaria) — controlar estoque é o caso COMUM, não exceção. Produto
-- de serviço/encomenda é exceção e o lojista desmarca conscientemente.
--
-- Aplicado em:
--   1. Schema Drizzle (src/db/schema/catalog.ts:136 e :337) — default true
--   2. Form de novo produto (new-product-form.tsx:75) — default true
--   3. Aqui — flip do DEFAULT do BD + UPDATE retroativo
--
-- DEPLOY
-- 1. ALTER COLUMN ... SET DEFAULT — metadata-only (instantâneo).
-- 2. UPDATE retroativo — varre tabela (cuidado em prod com volume grande,
--    mas Mangos Pay ainda não tem lojista real entrando — risco baixo).
--    Lojista que tiver produto que NÃO deveria ter tracking (serviço,
--    encomenda) precisa desligar manualmente no form do produto.
-- =====================================================================

-- 1. Flip DEFAULT (produtos futuros nascem com tracking ligado)
ALTER TABLE product
  ALTER COLUMN track_stock SET DEFAULT true;

ALTER TABLE product_variant
  ALTER COLUMN track_stock SET DEFAULT true;

-- 2. UPDATE retroativo — produtos existentes que vieram com false
--    Justificativa: o false anterior era bug, não escolha consciente
--    do lojista. Caso real de "serviço sem estoque" o lojista pode
--    desligar caso-a-caso depois.
UPDATE product
  SET track_stock = true
  WHERE track_stock = false;

UPDATE product_variant
  SET track_stock = true
  WHERE track_stock = false;
