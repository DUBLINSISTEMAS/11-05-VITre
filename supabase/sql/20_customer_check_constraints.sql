-- =====================================================================
-- Vitrê — CHECK constraints para `customer` (Fase 3 / ADR-0014)
-- =====================================================================
-- Defesa em profundidade: Zod valida no boundary das server actions,
-- mas DB expõe a tabela a SQL manual, scripts e futuras integrações.
-- Estas constraints são a 2ª camada — invariantes a nível de schema.
--
--   customer.phone           — E.164 obrigatório (LGPD: tabela tem PII)
--   customer.name            — 1..120 chars (trimado)
--   customer.email           — opcional, mas <= 254 chars quando presente
--   customer.address_state   — UF 2 letras maiúsculas OU NULL
--   customer.address_zip     — 8 dígitos OU NULL (sem máscara)
--   customer.notes           — máx 1000 chars OU NULL
--
-- Aplicar manualmente no Editor do Supabase APÓS rodar `pnpm db:migrate`
-- que aplica `0016_overrated_starhawk.sql`.
--
-- Idempotente: DROP IF EXISTS + IF NOT EXISTS guarded.
-- =====================================================================

-- ---------------------------------------------------------------------
-- customer.phone — E.164 (LGPD: tabela tem PII)
-- Mesmo padrão de order.customer_phone (SQL 12)
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_phone_e164_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_phone_e164_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_phone_e164_check"
      CHECK ("phone" ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- customer.name — trimado entre 1 e 120 chars
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_name_length_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_name_length_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_name_length_check"
      CHECK (char_length(trim("name")) BETWEEN 1 AND 120);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- customer.email — <= 254 chars quando NÃO NULL
-- (RFC 5321: 254 é o teto técnico de endereço SMTP)
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_email_length_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_email_length_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_email_length_check"
      CHECK ("email" IS NULL OR char_length("email") <= 254);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- customer.address_state — UF 2 letras maiúsculas OU NULL
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_address_state_uf_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_address_state_uf_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_address_state_uf_check"
      CHECK ("address_state" IS NULL OR "address_state" ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- customer.address_zip — 8 dígitos OU NULL (sem máscara)
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_address_zip_digits_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_address_zip_digits_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_address_zip_digits_check"
      CHECK ("address_zip" IS NULL OR "address_zip" ~ '^[0-9]{8}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- customer.notes — <= 1000 chars OU NULL
-- ---------------------------------------------------------------------
ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_notes_length_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customer_notes_length_check'
       AND conrelid = '"customer"'::regclass
  ) THEN
    ALTER TABLE "customer"
      ADD CONSTRAINT "customer_notes_length_check"
      CHECK ("notes" IS NULL OR char_length("notes") <= 1000);
  END IF;
END $$;
