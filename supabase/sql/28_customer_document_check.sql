-- =====================================================================
-- Vitrê — CHECK/UNIQUE de documento (CPF/CNPJ) em customer (ADR-0021)
-- =====================================================================
-- Aplicar APÓS rodar `pnpm db:migrate` que aplica drizzle/0020_customer_pf_pj.sql
-- (cria enum customer_type, adiciona colunas type + document).
--
-- Garantias:
--   1. document, se preenchido, tem só dígitos
--   2. document length bate com type (PF 11, PJ 14)
--   3. document é único por loja quando não-NULL (múltiplos NULL OK)
--
-- Idempotente: DROP CONSTRAINT IF EXISTS + IF NOT EXISTS guard (pattern
-- canônico Vitrê — Postgres não suporta ADD CONSTRAINT IF NOT EXISTS).
-- Aplicar via: pnpm exec tsx scripts/apply-sql.ts supabase/sql/28_customer_document_check.sql
-- =====================================================================

-- 1. Só dígitos
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_document_digits";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_document_digits'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_document_digits"
      CHECK (document IS NULL OR document ~ '^[0-9]+$');
  END IF;
END $$;

-- 2. Length bate com type
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_document_length";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_document_length'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_document_length"
      CHECK (
        document IS NULL
        OR (type = 'individual' AND length(document) = 11)
        OR (type = 'company'    AND length(document) = 14)
      );
  END IF;
END $$;

-- 3. UNIQUE parcial — dedup por documento DENTRO da loja, quando não-NULL.
--    `CREATE UNIQUE INDEX ... IF NOT EXISTS` é nativamente idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_store_document_unique"
  ON "customer" (store_id, document)
  WHERE document IS NOT NULL;

-- Verificação manual:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = '"customer"'::regclass
--   AND conname LIKE 'customer_document_%';
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE indexname = 'customer_store_document_unique';
