-- =====================================================================
-- Vitrê — CHECK constraints de domínio
-- =====================================================================
-- Defesa em profundidade: Zod valida no boundary do server action, mas o DB
-- precisa rejeitar igualmente caso uma mutação escape (script ad-hoc, SQL
-- manual). Cada constraint é idempotente via pg_constraint lookup.
--
-- ⚠️ Trade-off importante (decisão consciente):
-- O briefing pediu `base_price_in_cents > 0`, mas a auditoria pré-aplicação
-- encontrou 6 produtos com `base_price_in_cents = 0` — todos rascunhos
-- legítimos (slug `draft-*`, name vazio, is_active=false) criados pelo fluxo
-- `createDraftProduct` que cria draft com price 0 PROPOSITALMENTE
-- (ver src/actions/product/create-draft.ts:99). O Zod do form já permite
-- `min(0)` em todos os preços (src/actions/product/schema.ts), então o app
-- inteiro está alinhado em "preço zero é válido". Aplicamos `>= 0` em vez
-- de `> 0` pra refletir a realidade. Se algum dia a regra "produto publicado
-- precisa ter preço > 0" virar requisito, vira CHECK condicional
-- (`is_active = false OR base_price_in_cents > 0`) ou validação no publish.
--
-- Drizzle 0.45 não declara CHECK constraints de forma estável no schema TS,
-- então este SQL é o único source of truth. Comentários nas colunas dos
-- schemas TS apontam pra cá.
--
-- Idempotente: cada ADD CONSTRAINT é guardado por NOT EXISTS em pg_constraint.
-- =====================================================================

-- ---------------------------------------------------------------------
-- order_item.quantity > 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_item_quantity_check'
       AND conrelid = '"order_item"'::regclass
  ) THEN
    ALTER TABLE "order_item"
      ADD CONSTRAINT "order_item_quantity_check"
      CHECK ("quantity" > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- order.total_in_cents >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_total_in_cents_check'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_total_in_cents_check"
      CHECK ("total_in_cents" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product.base_price_in_cents >= 0   (não > 0 — drafts usam 0; ver header)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_base_price_in_cents_check'
       AND conrelid = '"product"'::regclass
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_base_price_in_cents_check"
      CHECK ("base_price_in_cents" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product.promo_price_in_cents IS NULL OR >= 0  (idem)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_promo_price_in_cents_check'
       AND conrelid = '"product"'::regclass
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_promo_price_in_cents_check"
      CHECK ("promo_price_in_cents" IS NULL OR "promo_price_in_cents" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product_variant.price_in_cents IS NULL OR >= 0  (idem)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_variant_price_in_cents_check'
       AND conrelid = '"product_variant"'::regclass
  ) THEN
    ALTER TABLE "product_variant"
      ADD CONSTRAINT "product_variant_price_in_cents_check"
      CHECK ("price_in_cents" IS NULL OR "price_in_cents" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product_variant.stock_quantity IS NULL OR >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_variant_stock_quantity_check'
       AND conrelid = '"product_variant"'::regclass
  ) THEN
    ALTER TABLE "product_variant"
      ADD CONSTRAINT "product_variant_stock_quantity_check"
      CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product.stock_quantity IS NULL OR >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_stock_quantity_check'
       AND conrelid = '"product"'::regclass
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_stock_quantity_check"
      CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- category.position >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'category_position_check'
       AND conrelid = '"category"'::regclass
  ) THEN
    ALTER TABLE "category"
      ADD CONSTRAINT "category_position_check"
      CHECK ("position" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- banner.position >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'banner_position_check'
       AND conrelid = '"banner"'::regclass
  ) THEN
    ALTER TABLE "banner"
      ADD CONSTRAINT "banner_position_check"
      CHECK ("position" >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- product_image.position >= 0
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_image_position_check'
       AND conrelid = '"product_image"'::regclass
  ) THEN
    ALTER TABLE "product_image"
      ADD CONSTRAINT "product_image_position_check"
      CHECK ("position" >= 0);
  END IF;
END $$;
