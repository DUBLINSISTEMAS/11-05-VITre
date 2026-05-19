-- ADR-0034 Camada 1 — purchase_item.total_cost_in_cents como GENERATED.
-- Drizzle não tem helper estável pra GENERATED ALWAYS AS — o schema
-- declara coluna comum integer NOT NULL e este SQL out-of-band a
-- converte em STORED generated.
--
-- IMPORTANTE: rodar UMA VEZ logo após a migration drizzle/0031_*.sql
-- ter criado a tabela. Idempotente — checa se a coluna já é generated
-- antes de tentar converter.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_item'
      AND column_name = 'total_cost_in_cents'
      AND is_generated = 'ALWAYS'
  ) THEN
    -- Drop a coluna comum criada pela migration Drizzle e recria como GENERATED.
    -- Como a tabela é nova (mesma migration), não há dados a preservar.
    ALTER TABLE "purchase_item" DROP COLUMN "total_cost_in_cents";
    ALTER TABLE "purchase_item"
      ADD COLUMN "total_cost_in_cents" integer
      GENERATED ALWAYS AS (quantity * unit_cost_in_cents) STORED;
  END IF;
END $$;
