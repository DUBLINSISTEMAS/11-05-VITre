-- =====================================================================
-- Vitrê — trigger anti-3-níveis em category (defesa em profundidade)
-- =====================================================================
-- App valida em Zod (max 2 níveis: raiz + filha direta). Mas o schema
-- Postgres permite self-FK arbitrário — mutação direta SQL ou bug futuro
-- poderia criar tree de 3+ níveis, quebrando o storefront que assume 2.
--
-- Trigger BEFORE INSERT/UPDATE rejeita:
--   1) parent_id apontando pra categoria que já tem parent_id NOT NULL
--      (= avô — categoria seria 3º nível)
--   2) parent_id == id (auto-referência)
--
-- Não checa ciclos profundos (A → B → A) — isto é raro e a app já
-- valida. Cobrir aqui exigiria recursive CTE em runtime — over-engineering.
--
-- Execução:
--   `npm run db:apply -- supabase/sql/14_category_max_depth_trigger.sql`
-- Idempotente: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- =====================================================================

CREATE OR REPLACE FUNCTION enforce_category_max_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Auto-referência (categoria sendo pai de si mesma)
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Categoria nao pode ser pai de si mesma'
        USING ERRCODE = '23514';
    END IF;

    -- Pai já é filho de outra categoria → seria 3º nível
    IF EXISTS (
      SELECT 1 FROM category
       WHERE id = NEW.parent_id
         AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Categoria nao pode ter avo (limite: 2 niveis)'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS category_max_depth_trigger ON category;

CREATE TRIGGER category_max_depth_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON category
  FOR EACH ROW
  EXECUTE FUNCTION enforce_category_max_depth();
