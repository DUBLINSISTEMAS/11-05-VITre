-- =====================================================================
-- Mangos Pay — quote_sheet: ficha de orçamento de balcão (2026-05-28)
-- =====================================================================
-- CONTEXTO
-- Joalheiro do ICP (interior, sem NF interna) usa caderno/talão pra orçar
-- peça personalizada — cliente fica com via assinada, lojista com via
-- assinada. Hoje orçamento no Mangos vem só do PDV itemizado
-- (`order.status='quote'`) — não cabe pra peça única com peso/material
-- descritivos.
--
-- Nova tabela `quote_sheet` = versão SaaS do talão. Texto livre em
-- "discriminação", valor total, entrada (com forma livre "Pix R$ 500",
-- "12× cartão"), restante auto-calculado. Imprime em A4 com assinaturas.
--
-- COEXISTE com `order.status='quote'` (PDV). Não é substituição — perfis
-- diferentes (joia/serviço vs roupa/perfumaria).
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS + ALTER…IF NOT EXISTS + DO $$ guards.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "quote_sheet" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "short_code" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "customer_document" text,
  "customer_city" text,
  "received_at" timestamp,
  "delivery_at" timestamp,
  "description" text NOT NULL,
  "total_in_cents" integer NOT NULL,
  "down_payment_in_cents" integer NOT NULL DEFAULT 0,
  "down_payment_note" text,
  "remainder_in_cents" integer NOT NULL,
  "notice_text" text,
  "created_by" text,
  "archived_at" timestamp,
  "deleted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- FKs + UNIQUE + CHECKs (idempotentes via NOT EXISTS sobre pg_constraint)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_store_id_store_id_fk') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_store_id_store_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_created_by_user_id_fk') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_created_by_user_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_store_short_code_unique') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_store_short_code_unique"
      UNIQUE ("store_id", "short_code");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_total_nonneg') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_total_nonneg"
      CHECK (total_in_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_down_nonneg') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_down_nonneg"
      CHECK (down_payment_in_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_down_le_total') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_down_le_total"
      CHECK (down_payment_in_cents <= total_in_cents);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_remainder_nonneg') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_remainder_nonneg"
      CHECK (remainder_in_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_description_length') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_description_length"
      CHECK (char_length(description) >= 1 AND char_length(description) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_notice_length') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_notice_length"
      CHECK (notice_text IS NULL OR char_length(notice_text) <= 600);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_customer_name_length') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_customer_name_length"
      CHECK (char_length(customer_name) BETWEEN 1 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sheet_down_payment_note_length') THEN
    ALTER TABLE "quote_sheet" ADD CONSTRAINT "quote_sheet_down_payment_note_length"
      CHECK (down_payment_note IS NULL OR char_length(down_payment_note) <= 160);
  END IF;
END $$;

-- Índices (parcial pra ignorar arquivado/deletado nas queries de listing)
CREATE INDEX IF NOT EXISTS "quote_sheet_store_idx"
  ON "quote_sheet" ("store_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "quote_sheet_short_code_idx"
  ON "quote_sheet" ("short_code");

-- RLS tenant_isolation — mesmo padrão de storefront_collection (SQL 39),
-- camada_comercial (SQL 46) etc.
ALTER TABLE "quote_sheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_sheet" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_sheet_tenant_isolation ON "quote_sheet";
CREATE POLICY quote_sheet_tenant_isolation ON "quote_sheet"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- GRANT pra role authenticated (alinhado com supabase setup canônico)
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_sheet" TO authenticated;

COMMENT ON TABLE "quote_sheet" IS
  'Ficha de orçamento de balcão (ICP joia/servico). Texto livre em description, valor + entrada com forma livre + restante. Imprime A4 com assinaturas. Coexiste com order.status=quote (PDV itemizado).';
COMMENT ON COLUMN "quote_sheet"."description" IS
  'Discriminação - texto livre da peça, peso, material, observações.';
COMMENT ON COLUMN "quote_sheet"."down_payment_note" IS
  'Forma livre da entrada - "Pix R$ 500", "12x cartão", "à vista". Sem semântica enforced.';
COMMENT ON COLUMN "quote_sheet"."notice_text" IS
  'Aviso/rodapé livre que entra no fim da ficha impressa.';
