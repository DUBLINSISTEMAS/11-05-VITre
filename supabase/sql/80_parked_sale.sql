-- =====================================================================
-- Mangos Pay — Pausa-venda no PDV (S3.3 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- Vendedora atende 3 clientes simultaneos. Cliente A pediu mais peças,
-- B chega impaciente, C quer trocar. Hoje vendedora trava no PDV
-- "memory state local" — sem como segurar carrinho de A pra atender B
-- sem perder estado.
--
-- DESIGN
-- - parked_sale guarda items + customer + label.
-- - Items em jsonb (snapshot de produto/variante/preço — não precisa de
--   FK, retomada recalcula).
-- - Auto-expira em 4h (cron OU check ao listar).
-- - Lojista (1 user) pode ter múltiplos parkeds simultaneos.
--
-- Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS parked_sale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  /** Cliente vinculado (opcional). NULL = walk-in. */
  customer_id uuid REFERENCES customer(id) ON DELETE SET NULL,
  /** Texto livre pra identificar (ex: "Cliente da camisa azul"). */
  label text,

  /** Items do carrinho. Schema: [{ productId, variantId, quantity, ... }]. */
  items jsonb NOT NULL DEFAULT '[]'::jsonb,

  parked_at timestamptz NOT NULL DEFAULT now(),
  /** Expira em 4h por default. Cron pode limpar; UI ignora >expires_at. */
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '4 hours'),

  CONSTRAINT parked_sale_label_length CHECK (label IS NULL OR length(label) <= 60),
  CONSTRAINT parked_sale_items_array CHECK (jsonb_typeof(items) = 'array')
);

-- Hot path: lista de pausados do user no store.
CREATE INDEX IF NOT EXISTS parked_sale_user_store_idx
  ON parked_sale (store_id, user_id, parked_at DESC);

-- Cleanup cron: expirados ordenados por expires_at.
CREATE INDEX IF NOT EXISTS parked_sale_expires_idx
  ON parked_sale (expires_at);

-- RLS — mesmo pattern receivable.
ALTER TABLE parked_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE parked_sale FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parked_sale_tenant_isolation ON parked_sale;
CREATE POLICY parked_sale_tenant_isolation ON parked_sale
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON parked_sale TO vitre_app;

COMMENT ON TABLE parked_sale IS
  'Carrinho pausado no PDV (S3.3 Plano de Endurecimento). Atender outro cliente sem perder estado.';
