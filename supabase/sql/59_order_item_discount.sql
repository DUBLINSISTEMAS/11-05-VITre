-- =====================================================================
-- Mangos Pay — order_item.discount_in_cents (desconto por item no PDV)
-- =====================================================================
-- Adiciona desconto individual por linha do pedido. Complementa o
-- discount_in_cents do nível do pedido (já existente) — agora lojista
-- pode dar desconto seletivo (ex: 10% só no anel, em vez de no carrinho
-- inteiro).
--
-- Por quê AGORA (mid-Fase 2):
--   Decisão do founder 2026-05-21. Não é Fase 2 (multi-tenant) mas o
--   fluxo de "lojista cobra cliente com desconto seletivo" é diário em
--   joia/perfumaria/calçados e o PDV não suportava — gargalo real de
--   operação. Veio antes da Fase 4 original.
--
-- Modelagem:
--   - INTEGER NULLABLE. NULL = sem desconto (default, backward-compat
--     com 100% dos pedidos existentes).
--   - Snapshot por linha; combina com priceInCentsSnapshot pra fixar
--     histórico (margem por produto, DRE, top produtos continuam fiéis).
--   - Source of truth em centavos (não %). % é só UX no PdvShell —
--     server converte pra cents antes de persistir.
--
-- CHECK constraints:
--   1. order_item_discount_nonneg: desconto >= 0 (não-negativo)
--   2. order_item_discount_not_above_line: desconto <= price × qty
--      (não pode levar o subtotal da linha pra negativo; pode zerar)
--
-- Idempotente: DROP IF EXISTS guards + IF NOT EXISTS na ADD COLUMN.
-- Aplicar APÓS rodar drizzle migration 0033 que cria a coluna.
-- Aplicar via: pnpm exec tsx scripts/apply-sql.ts supabase/sql/59_order_item_discount.sql
-- =====================================================================

-- Drop primeiro pra reaplicar limpo (idempotente).
ALTER TABLE "order_item"
  DROP CONSTRAINT IF EXISTS "order_item_discount_nonneg";

ALTER TABLE "order_item"
  DROP CONSTRAINT IF EXISTS "order_item_discount_not_above_line";

-- CHECK 1: desconto não pode ser negativo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_item_discount_nonneg'
       AND conrelid = '"order_item"'::regclass
  ) THEN
    ALTER TABLE "order_item"
      ADD CONSTRAINT "order_item_discount_nonneg"
      CHECK (discount_in_cents IS NULL OR discount_in_cents >= 0);
  END IF;
END $$;

-- CHECK 2: desconto não pode passar do subtotal da linha (preço × qty).
-- Limite superior: levar a linha a zero ok; negativo NÃO.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_item_discount_not_above_line'
       AND conrelid = '"order_item"'::regclass
  ) THEN
    ALTER TABLE "order_item"
      ADD CONSTRAINT "order_item_discount_not_above_line"
      CHECK (
        discount_in_cents IS NULL
        OR discount_in_cents <= price_in_cents_snapshot * quantity
      );
  END IF;
END $$;

-- Verificação manual:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"order_item"'::regclass
--   AND conname LIKE 'order_item_discount%';
