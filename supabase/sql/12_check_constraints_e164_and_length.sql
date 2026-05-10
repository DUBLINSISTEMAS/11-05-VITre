-- =====================================================================
-- Vitrê — CHECK constraints E.164 + length (defesa em profundidade PII)
-- =====================================================================
-- Zod valida formato/tamanho no boundary das server actions, mas DB
-- expõe a tabela a SQL manual, scripts, ou futuras integrações. Estas
-- constraints adicionam a 2ª camada de invariantes a nível de schema.
--
--   order.customer_phone        — E.164 obrigatório (+ dígitos 7..15)
--   store.whatsapp_number       — E.164 obrigatório
--   order.customer_notes        — máx 2000 chars (proteção contra log spam)
--   account.password (auth)     — quando NOT NULL, length >= 50 (bcrypt
--                                 hash típico ~60). Bloqueia UPDATE direto
--                                 acidental com string curta.
--
-- Execução:
--   `npm run db:apply -- supabase/sql/12_check_constraints_e164_and_length.sql`
-- Idempotente: DROP IF EXISTS + CREATE guardado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- order.customer_phone — E.164 (LGPD: tabela tem PII)
-- ---------------------------------------------------------------------
ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_customer_phone_e164_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_customer_phone_e164_check'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_customer_phone_e164_check"
      CHECK ("customer_phone" ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- store.whatsapp_number — E.164
-- ---------------------------------------------------------------------
ALTER TABLE "store"
  DROP CONSTRAINT IF EXISTS "store_whatsapp_e164_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_whatsapp_e164_check'
       AND conrelid = '"store"'::regclass
  ) THEN
    ALTER TABLE "store"
      ADD CONSTRAINT "store_whatsapp_e164_check"
      CHECK ("whatsapp_number" ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- order.customer_notes — máx 2000 chars (nullable na tabela; o CHECK
-- só dispara quando NÃO NULL)
-- ---------------------------------------------------------------------
ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS "order_customer_notes_length_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_customer_notes_length_check'
       AND conrelid = '"order"'::regclass
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_customer_notes_length_check"
      CHECK ("customer_notes" IS NULL OR length("customer_notes") <= 2000);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- account.password — quando NÃO NULL, length >= 50 (bcrypt típico ~60)
-- Better Auth gerencia o campo, mas defesa em profundidade contra
-- UPDATE manual com string vazia/curta que tornaria a conta autenticável
-- de forma frágil.
-- ---------------------------------------------------------------------
ALTER TABLE "account"
  DROP CONSTRAINT IF EXISTS "account_password_length_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'account_password_length_check'
       AND conrelid = '"account"'::regclass
  ) THEN
    ALTER TABLE "account"
      ADD CONSTRAINT "account_password_length_check"
      CHECK ("password" IS NULL OR length("password") >= 50);
  END IF;
END $$;
