-- =====================================================================
-- Mangos Pay — Tabela `product_cost_component` (custo detalhado por material)
-- =====================================================================
-- CONTEXTO
-- Joalheiro precisa quebrar o custo de uma peça em componentes:
-- "ouro 18k R$ 800 + mão-de-obra R$ 120 + embalagem R$ 5". Hoje o
-- product.cost_price_in_cents é um único número opaco — ao reprecificar
-- quando o metal sobe, ninguém lembra de quanto era do ouro.
--
-- A soma dos componentes vira o cost_price_in_cents do produto (gravado
-- pela server action `saveCostComponents`). Esta tabela é a fonte de
-- verdade pro detalhamento; a coluna no product permanece como agregado
-- pra performance (já consumida em DRE/margem).
--
-- DESIGN
-- - label text livre (varia muito por nicho — joia ≠ perfumaria).
-- - amount_in_cents integer >= 0 (componente pode ser zero — placeholder).
-- - position integer ordena na UI.
-- - Cascade no store_id e product_id: apagou produto, apagou componentes.
--
-- RLS-first (princípio CLAUDE.md #1). Pattern espelha expense (75_*).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_cost_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_in_cents integer NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT product_cost_component_amount_nonneg CHECK (amount_in_cents >= 0),
  CONSTRAINT product_cost_component_label_length CHECK (length(label) BETWEEN 1 AND 120)
);

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_cost_component_store_idx
  ON product_cost_component (store_id);

CREATE INDEX IF NOT EXISTS product_cost_component_product_idx
  ON product_cost_component (product_id);

-- ---------------------------------------------------------------------
-- 3. RLS — pattern expense
-- ---------------------------------------------------------------------
ALTER TABLE product_cost_component ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cost_component FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_cost_component_tenant_isolation ON product_cost_component;
CREATE POLICY product_cost_component_tenant_isolation ON product_cost_component
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- ---------------------------------------------------------------------
-- 4. GRANTs pra vitre_app (DEFAULT PRIVILEGES já cobre, mas explícito é melhor)
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON product_cost_component TO vitre_app;

COMMENT ON TABLE product_cost_component IS
  'Quebra do custo do produto em componentes (ouro 18k, mão-de-obra, embalagem). Soma vira product.cost_price_in_cents via server action.';
