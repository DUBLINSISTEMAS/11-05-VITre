-- =====================================================================
-- Mangos Pay — Sprint 5.4 (2026-05-22): customer_group.default_pricing_tier
-- =====================================================================
-- CONTEXTO
-- Grupos de cliente (ex: "VIP", "Revenda", "Atacado") até hoje só
-- carregavam discountBps. Pra ativar o "5º fantasma" do plano (grupo
-- afeta PDV), precisamos sinalizar QUAL preço do produto usar quando
-- cliente do grupo é selecionado no PDV.
--
-- 'regular'   = preço normal (base/promo conforme janela ativa)
-- 'wholesale' = preço atacado (product.wholesale_price_in_cents)
--               com fallback no normal se NULL.
--
-- Não substitui discountBps — coexiste. Lojista pode ter "Revenda" com
-- pricing_tier='wholesale' E discount 5% extra.
--
-- DEPLOY
-- ADD COLUMN com DEFAULT + NOT NULL é metadata-only no PostgreSQL 11+
-- (não scaneia tabela). Default 'regular' preserva comportamento atual
-- de todos os grupos existentes.
-- =====================================================================

-- Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_pricing_tier') THEN
    CREATE TYPE "customer_pricing_tier" AS ENUM ('regular', 'wholesale');
  END IF;
END $$;

-- Coluna
ALTER TABLE customer_group
  ADD COLUMN IF NOT EXISTS default_pricing_tier customer_pricing_tier
  NOT NULL DEFAULT 'regular';
