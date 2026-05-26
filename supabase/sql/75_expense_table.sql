-- =====================================================================
-- Mangos Pay — Tabela `expense` (S2.1 do Plano de Endurecimento)
-- =====================================================================
-- CONTEXTO
-- DRE simplificado atual calcula apenas Receita − CMV = "Lucro bruto".
-- Sem aluguel, salário, comissão, taxa cartão, conta de luz. Lojista BR
-- vê "Lucro bruto R$ 30k" e estoura caixa no fim do mês.
--
-- Esta tabela cobre as DESPESAS OPERACIONAIS estruturadas. Não é livro
-- caixa (que tem outras semânticas — entradas, vendas em dinheiro fora
-- de caixa, etc) — é só o fluxo "lojista pagou conta X em data Y".
--
-- DESIGN
-- - category enum fixo (não free-form) — facilita relatório, evita drift
--   de "Aluguel" vs "aluguel" vs "alug.". Categorias cobrem 95% do varejo BR.
-- - amount_cents always positive (não tem despesa negativa — refund de
--   conta vira lançamento à parte ou estorno via append-only futuro).
-- - paid_at: quando foi efetivamente pago. NULL = pendente.
-- - due_date: vencimento. NULL = pagamento à vista no momento.
-- - supplier_id: FK opcional. Lançamento "Aluguel imóvel" geralmente
--   não tem supplier cadastrado. "Compra de embalagem 50un" tem.
-- - recurring: para mensalidades fixas. Quando true, app-layer GERA
--   12 entries no INSERT (não 1 entry "recurring" — explícito é melhor
--   pra relatórios). Coluna serve só pra UI saber que veio de recorrente.
-- - notes: texto livre 500 chars.
--
-- RLS-first (princípio CLAUDE.md #1). Policies espelham padrão receivable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum de categoria (compartilha namespace, então não pode colidir)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'rent',           -- aluguel
      'payroll',        -- salário/comissão pagos a equipe
      'utilities',      -- luz/agua/internet
      'supplies',       -- materiais de consumo (embalagem, etiquetas)
      'marketing',      -- ads, brindes, design
      'tax',            -- impostos diversos (ISS, IPTU, INSS)
      'card_fees',      -- taxas reais da maquininha
      'other'           -- catch-all
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,

  category expense_category NOT NULL DEFAULT 'other',
  amount_in_cents integer NOT NULL,
  paid_at date,
  due_date date,
  supplier_id uuid REFERENCES supplier(id) ON DELETE SET NULL,
  recurring boolean NOT NULL DEFAULT false,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT expense_amount_positive CHECK (amount_in_cents > 0),
  CONSTRAINT expense_notes_length CHECK (notes IS NULL OR length(notes) <= 500),
  -- Pelo menos um dos dois: paid_at (efetivado) ou due_date (a vencer).
  CONSTRAINT expense_has_date CHECK (paid_at IS NOT NULL OR due_date IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------
-- Listagem padrão: "despesas do mês ordenadas por paid_at DESC".
CREATE INDEX IF NOT EXISTS expense_store_paid_at_idx
  ON expense (store_id, paid_at DESC);

-- Filtro por categoria pra relatório.
CREATE INDEX IF NOT EXISTS expense_store_category_idx
  ON expense (store_id, category);

-- Filtro por supplier pra "quanto paguei pra fornecedor X este ano".
CREATE INDEX IF NOT EXISTS expense_store_supplier_idx
  ON expense (store_id, supplier_id)
  WHERE supplier_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. RLS — pattern receivable
-- ---------------------------------------------------------------------
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_tenant_isolation ON expense;
CREATE POLICY expense_tenant_isolation ON expense
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- ---------------------------------------------------------------------
-- 5. GRANTs pra vitre_app
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON expense TO vitre_app;

COMMENT ON TABLE expense IS
  'Despesas operacionais da loja. S2.1 — destrava DRE honesto. RLS por store_id.';

COMMENT ON COLUMN expense.recurring IS
  'true = veio de "Repetir mensalmente" no form. App-layer geral 12 entries no INSERT (não 1). Coluna existe pra UI marcar visualmente.';
