-- =====================================================================
-- Mangos Pay — Quota por loja (S1.3 do Plano de Endurecimento, 2026-05-26)
-- =====================================================================
-- CONTEXTO
-- Hoje qualquer loja pode subir 10k produtos × 8 imagens × 5MB = 400GB
-- no Supabase Storage. Sem hard limit, lojista malicioso ou bug de
-- importação infinita destrói custo. Auditoria sênior cruzada (Agent A)
-- flaggou como bloqueador #4 pra 10-15 lojas em produção.
--
-- DESIGN
-- Limites POR LOJA, defaults conservadores pro plano Free:
--   max_products_count = 1000  (joalheria média do ICP tem 200-500 SKUs)
--   max_image_mb       = 2     (sharp já comprime pra ~150KB, 2MB é safety net)
--
-- Plano Pago futuro (Fase 3) sobe estes valores via UPDATE da row
-- da loja específica. Sem nova tabela `plan` — config inline na store
-- é simples e suficiente até 30 lojas.
--
-- ENFORCEMENT
-- App-layer em src/actions/product/create.ts (count + 1 <= max) e
-- src/actions/product-image/upload.ts (size in bytes <= max * 1MB).
-- NÃO via trigger pra evitar overhead em transações de produto.
-- Mensagem PT-BR clara pro lojista: "Limite de X produtos atingido".
--
-- Idempotente. Apenas ALTER ADD COLUMN IF NOT EXISTS (Postgres 9.6+).
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS max_products_count integer NOT NULL DEFAULT 1000;

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS max_image_mb integer NOT NULL DEFAULT 2;

-- CHECK constraints — defesa em profundidade contra UPDATE manual
-- gravando valores absurdos. Range 1..100000 produtos / 1..50 MB.
ALTER TABLE store
  DROP CONSTRAINT IF EXISTS store_max_products_count_range;
ALTER TABLE store
  ADD CONSTRAINT store_max_products_count_range
  CHECK (max_products_count >= 1 AND max_products_count <= 100000);

ALTER TABLE store
  DROP CONSTRAINT IF EXISTS store_max_image_mb_range;
ALTER TABLE store
  ADD CONSTRAINT store_max_image_mb_range
  CHECK (max_image_mb >= 1 AND max_image_mb <= 50);

COMMENT ON COLUMN store.max_products_count IS
  'Limite máximo de produtos da loja. Default 1000 (Free). Plano pago sobe via UPDATE.';

COMMENT ON COLUMN store.max_image_mb IS
  'Tamanho máximo de imagem em MB. Default 2 (sharp comprime pra ~150KB, 2MB é safety net).';
