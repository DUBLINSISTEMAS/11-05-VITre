-- =====================================================================
-- Mangos Pay — Bloco H (2026-05-29): compras de verdade
-- =====================================================================
-- CONTEXTO
-- Diagnóstico de Compras apontou 3 buracos críticos:
--   1. NF real tem frete + desconto + impostos. Schema ignorava — lojista
--      embutia no custo unitário (mata o WAC) ou simplesmente perdia info.
--   2. Cartão parcelado (3×/6×/12×) virava 1 compra "à vista ou a pagar".
--      Vencimentos reais ficavam fora do controle.
--   3. "A pagar" não tinha data nem vencia em /financeiro/pagar — compra
--      ficava órfã do financeiro.
--
-- DECISÃO SÊNIOR
-- `/admin/financeiro/pagar` JÁ consome `expense` table (loadExpenses).
-- Em vez de criar `account_payable` nova, REUSAMOS expense:
--   - createPurchase gera N expenses (parceladas), cada uma com
--     due_date espaçada (30/60/90 dias) e supplier_id vinculado.
--   - paidNow=true gera 1 expense com paid_at=now() de uma vez.
--   - expense.purchase_id NOVA coluna trackeia origem pra:
--       (a) navegação reversa "ver compra desta conta"
--       (b) deletar compra estorna expenses derivadas
--       (c) /financeiro/pagar exibe etiqueta "Compra #ABC123 · 2/3"
--
-- IDEMPOTÊNCIA
-- Tudo `IF NOT EXISTS` + `DROP CONSTRAINT IF EXISTS` antes de adicionar
-- CHECK. Roda em prod (sem efeito se já aplicado) e em DB virgem (cria).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. purchase: frete + desconto + impostos + installments_count
-- ---------------------------------------------------------------------
ALTER TABLE "purchase"
  ADD COLUMN IF NOT EXISTS "freight_in_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchase"
  ADD COLUMN IF NOT EXISTS "discount_in_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchase"
  ADD COLUMN IF NOT EXISTS "taxes_in_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchase"
  ADD COLUMN IF NOT EXISTS "installments_count" smallint NOT NULL DEFAULT 1;

ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS "purchase_freight_nonneg";
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_freight_nonneg"
  CHECK (freight_in_cents >= 0);

ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS "purchase_discount_nonneg";
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_discount_nonneg"
  CHECK (discount_in_cents >= 0);

ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS "purchase_taxes_nonneg";
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_taxes_nonneg"
  CHECK (taxes_in_cents >= 0);

ALTER TABLE "purchase" DROP CONSTRAINT IF EXISTS "purchase_installments_range";
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_installments_range"
  CHECK (installments_count >= 1 AND installments_count <= 24);

COMMENT ON COLUMN "purchase"."freight_in_cents" IS
  'Frete cobrado pelo fornecedor na NF. Rateia entre itens só pra display — não muda WAC unitário (decisão pragmática: rateio "perfeito" exige escolha de critério, lojista faz no Excel se quiser).';
COMMENT ON COLUMN "purchase"."discount_in_cents" IS
  'Desconto comercial da NF (linha agregada, não por item). Subtrai do total.';
COMMENT ON COLUMN "purchase"."taxes_in_cents" IS
  'Impostos destacados na NF que entram no custo total (ICMS-ST, IPI, etc).';
COMMENT ON COLUMN "purchase"."installments_count" IS
  'Quantidade de parcelas. 1 = à vista. 2..24 = cada parcela vira 1 expense com due_date espaçada (default 30d entre parcelas).';

-- ---------------------------------------------------------------------
-- 2. expense.purchase_id — FK opcional pra trackear origem
-- ---------------------------------------------------------------------
ALTER TABLE "expense"
  ADD COLUMN IF NOT EXISTS "purchase_id" uuid;

-- FK isolada do ADD COLUMN pra ser idempotente (FK já existir não falha).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_purchase_id_fk'
  ) THEN
    ALTER TABLE "expense"
      ADD CONSTRAINT "expense_purchase_id_fk"
      FOREIGN KEY ("purchase_id") REFERENCES "purchase"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "expense_purchase_idx"
  ON "expense" ("purchase_id")
  WHERE "purchase_id" IS NOT NULL;

COMMENT ON COLUMN "expense"."purchase_id" IS
  'Bloco H (2026-05-29): NOT NULL quando esta despesa foi gerada automaticamente por createPurchase (parcela de compra). NULL = lançamento manual. Permite navegação reversa "ver compra desta conta" e badge "Compra #X · parcela N/Y" em /financeiro/pagar.';
