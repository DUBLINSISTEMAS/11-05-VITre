-- =====================================================================
-- Mangos Pay — Onda 2 (2026-05-28): product.archived_at + deleted_at
-- =====================================================================
-- CONTEXTO
-- FAXINA-2026-05-28.md item pendente: distinguir "pausado pelo lojista"
-- de "arquivado/removido". Hoje delete.ts (linhas 21-25) e bulk-delete.ts
-- (linha 26) simulam arquivamento via combinação
-- isActive=false + isPublishedToStorefront=false + isFeatured=false.
--
-- Funciona, mas não diferencia:
--   - "Pausei venda dessa peça temporariamente" (volta em 2 semanas) → isActive=false
--   - "Tirei do catálogo definitivamente" (acabou estoque, não recompro) → archived
--   - "Removi do sistema" (era cadastro errado / duplicata) → deleted (soft)
--
-- DESIGN
--   archived_at timestamptz nullable — produto arquivado (some das listas
--     padrão; volta com filtro "arquivados"; preserva histórico/relatórios).
--     Quando NOT NULL, app-layer força isActive=false e
--     isPublishedToStorefront=false.
--   deleted_at timestamptz nullable — soft-delete. Some até de "arquivados".
--     Reservado pra cleanup de cadastros errados. Aparece só em audit.
--
-- Ambos nullable, sem CHECK relacional — app-layer (delete.ts / bulk-delete.ts
-- na Onda 3) gerencia a transição. Schema neutro pra não trancar evolução
-- futura.
--
-- Idempotente. ALTER ADD COLUMN IF NOT EXISTS.
-- =====================================================================

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- Índice parcial: queries do dia-a-dia filtram WHERE deleted_at IS NULL,
-- e a maioria também filtra archived_at IS NULL. Cobre listing principal
-- sem pagar storage de índice cheio.
CREATE INDEX IF NOT EXISTS "product_active_idx_v2"
  ON "product" ("store_id")
  WHERE "deleted_at" IS NULL AND "archived_at" IS NULL;

COMMENT ON COLUMN "product"."archived_at" IS
  'NULL = ativo. NOT NULL = arquivado (some das listas padrão, preserva histórico). Onda 2 da ressignificação.';
COMMENT ON COLUMN "product"."deleted_at" IS
  'NULL = não removido. NOT NULL = soft-delete (cadastro errado/duplicata). Some até de arquivados.';
