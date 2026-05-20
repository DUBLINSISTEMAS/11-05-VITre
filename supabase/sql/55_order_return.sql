-- Pre-Sprint-6 C — devolução de venda balcão.
--
-- Hoje: cliente devolve produto, lojista NÃO TEM como registrar no
-- sistema. Operação corriqueira no varejo BR sem caminho — workaround
-- atual é cancelar a venda (que estraga relatórios) ou SQL manual.
--
-- Solução append-only: tabela order_return com FK pro order original.
-- Item-a-item em order_return_item pra v2 (devolução parcial). V1 só
-- aceita type='full' (devolução total da venda) — código frontend
-- inclui TODOS os order_items como linha em order_return_item.
--
-- Efeitos colaterais (gerenciados pelo app, NÃO por trigger):
--   1. stock_movement type='return' por item devolvido (entrada,
--      restaura saldo). Helper restockOrderItems reusa.
--   2. order.status = 'returned' (novo valor no enum).
--   3. cash_adjustment 'other_out' no caixa aberto (saída pelo total
--      devolvido — espelho da entrada da venda).
--
-- Idempotente.

-- =====================================================================
-- 1. Novo valor no enum order_status — devolvido.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
      AND enumlabel = 'returned'
  ) THEN
    ALTER TYPE "order_status" ADD VALUE 'returned';
  END IF;
END $$;

-- =====================================================================
-- 2. Tipo de devolução — full (v1) | partial (v2).
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_return_type') THEN
    CREATE TYPE "order_return_type" AS ENUM ('full', 'partial');
  END IF;
END $$;

-- =====================================================================
-- 3. Tabela order_return.
-- =====================================================================
CREATE TABLE IF NOT EXISTS "order_return" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "store"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "order"("id") ON DELETE RESTRICT,

  "return_type" order_return_type NOT NULL DEFAULT 'full',
  /**
   * Total devolvido em centavos. Pra type='full', deve bater com
   * order.total_in_cents. Pra type='partial', soma das devoluções
   * dos items. Verificação no app (CHECK > 0 garante baseline).
   */
  "refunded_in_cents" integer NOT NULL,

  "reason" text NOT NULL,

  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by_user_id" text NOT NULL REFERENCES "user"("id"),

  -- ID do cash_adjustment gerado, se houve caixa aberto. NULL se
  -- venda foi sem caixa formal.
  "cash_adjustment_id" uuid REFERENCES "cash_adjustment"("id") ON DELETE SET NULL
);

-- CHECKs
ALTER TABLE "order_return"
  DROP CONSTRAINT IF EXISTS order_return_refunded_positive;
ALTER TABLE "order_return"
  ADD CONSTRAINT order_return_refunded_positive
  CHECK (refunded_in_cents > 0);

ALTER TABLE "order_return"
  DROP CONSTRAINT IF EXISTS order_return_reason_length;
ALTER TABLE "order_return"
  ADD CONSTRAINT order_return_reason_length
  CHECK (char_length(reason) >= 3 AND char_length(reason) <= 500);

-- Unique parcial: um order só pode ter UMA devolução do tipo 'full'.
-- (Devoluções parciais múltiplas serão permitidas em v2.)
CREATE UNIQUE INDEX IF NOT EXISTS order_return_full_unique
  ON "order_return"("order_id")
  WHERE return_type = 'full';

CREATE INDEX IF NOT EXISTS order_return_order_idx
  ON "order_return"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS order_return_store_created_idx
  ON "order_return"("store_id", "created_at");

-- =====================================================================
-- 4. Tabela order_return_item.
-- =====================================================================
CREATE TABLE IF NOT EXISTS "order_return_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_return_id" uuid NOT NULL
    REFERENCES "order_return"("id") ON DELETE CASCADE,
  "order_item_id" uuid NOT NULL
    REFERENCES "order_item"("id") ON DELETE RESTRICT,
  "quantity_returned" integer NOT NULL,
  "refunded_in_cents" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "order_return_item"
  DROP CONSTRAINT IF EXISTS order_return_item_qty_positive;
ALTER TABLE "order_return_item"
  ADD CONSTRAINT order_return_item_qty_positive
  CHECK (quantity_returned > 0);

ALTER TABLE "order_return_item"
  DROP CONSTRAINT IF EXISTS order_return_item_refunded_positive;
ALTER TABLE "order_return_item"
  ADD CONSTRAINT order_return_item_refunded_positive
  CHECK (refunded_in_cents > 0);

CREATE INDEX IF NOT EXISTS order_return_item_return_idx
  ON "order_return_item"("order_return_id");
CREATE INDEX IF NOT EXISTS order_return_item_order_item_idx
  ON "order_return_item"("order_item_id");

-- =====================================================================
-- 5. RLS — pattern igual aos outros (order_payment, cash_adjustment).
-- =====================================================================
ALTER TABLE "order_return" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_return" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_return_tenant_isolation ON "order_return";
CREATE POLICY order_return_tenant_isolation ON "order_return"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- order_return_item herda via JOIN (mesmo pattern de purchase_item +
-- order_payment). Sem store_id direto pra reduzir denormalização.
ALTER TABLE "order_return_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_return_item" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_return_item_tenant_isolation ON "order_return_item";
CREATE POLICY order_return_item_tenant_isolation ON "order_return_item"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "order_return" r
      WHERE r.id = order_return_item.order_return_id
        AND r.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "order_return" r
      WHERE r.id = order_return_item.order_return_id
        AND r.store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid
    )
  );
