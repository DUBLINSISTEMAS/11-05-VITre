-- =====================================================================
-- 17_cleanup_orphan_drafts.sql — Limpa produtos rascunho órfãos
-- =====================================================================
--
-- CONTEXTO
-- --------
-- Antes do fix `d0c5804` o admin criava drafts implícitos sempre que o
-- lojista clicava em "+ Novo produto". Vários ficaram no banco sem nome,
-- com slug `draft-*`, e apareciam como "produto fantasma" na listagem.
--
-- Hoje (pós-d0c5804) produtos só são persistidos no submit explícito,
-- mas drafts legados continuam ocupando linhas. Este script remove os
-- que claramente são lixo:
--   - slug começa com `draft-`
--   - nome em branco
--   - SEM imagens (lojista nunca subiu nada)
--   - SEM variantes
--   - SEM pedidos associados (defesa adicional — drafts não deveriam
--     ter pedidos, mas garantimos)
--   - Mais velhos que 24h (deixa drafts recentes em paz por garantia
--     contra race com o frontend; ajusta pra `interval '0'` se quiser
--     limpar tudo)
--
-- COMO RODAR
-- ----------
-- 1. Supabase Dashboard → SQL Editor
-- 2. Cole TUDO abaixo, rode
-- 3. Confira o `RAISE NOTICE` no Messages — mostra quantas linhas
--    foram removidas por loja
-- 4. Se quiser conferir antes, descomente o bloco `-- DRY RUN` e
--    comente o DELETE
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser, nunca apaga produto
-- com conteúdo de verdade.
-- =====================================================================

BEGIN;

-- ---------- DRY RUN (opcional) -----------------------------------------
-- Descomente o bloco abaixo pra ver o que SERIA deletado sem deletar.
--
-- SELECT
--   p.store_id,
--   COUNT(*) AS drafts_orfaos,
--   array_agg(p.id) AS sample_ids
-- FROM product p
-- WHERE p.slug LIKE 'draft-%'
--   AND btrim(p.name) = ''
--   AND p.created_at < now() - interval '24 hours'
--   AND NOT EXISTS (
--     SELECT 1 FROM product_image pi WHERE pi.product_id = p.id
--   )
--   AND NOT EXISTS (
--     SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id
--   )
--   AND NOT EXISTS (
--     SELECT 1 FROM order_item oi WHERE oi.product_id = p.id
--   )
-- GROUP BY p.store_id;
-- -----------------------------------------------------------------------

WITH deleted AS (
  DELETE FROM product p
  WHERE p.slug LIKE 'draft-%'
    AND btrim(p.name) = ''
    AND p.created_at < now() - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM product_image pi WHERE pi.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM order_item oi WHERE oi.product_id = p.id
    )
  RETURNING id, store_id
)
SELECT
  store_id,
  COUNT(*) AS drafts_removidos
FROM deleted
GROUP BY store_id
ORDER BY drafts_removidos DESC;

COMMIT;
