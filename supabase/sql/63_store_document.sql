-- =====================================================================
-- Mangos Pay — Onda 2.7 (2026-05-22): store.document (CNPJ/CPF)
-- =====================================================================
-- CONTEXTO
-- Recibo/A4/Z hoje mostra só nome da loja e data. CLAUDE.md exige
-- cabeçalho universal com CNPJ. Adicionamos `document` em store (texto
-- livre 11 ou 14 dígitos sem máscara, mesma convenção de customer.document
-- e supplier.document).
--
-- Mangos Pay NÃO valida nem calcula imposto a partir disso (ADR-0033 —
-- veto fiscal). Campo livre pra aparecer impresso quando lojista quiser
-- documentar.
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS document text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_document_length'
       AND conrelid = '"store"'::regclass
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_document_length
      CHECK (document IS NULL OR char_length(document) BETWEEN 11 AND 14);
  END IF;
END $$;
