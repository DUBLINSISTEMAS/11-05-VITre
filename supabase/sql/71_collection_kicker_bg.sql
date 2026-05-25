-- 71_collection_kicker_bg.sql — PP5 (handoff pixel-perfect 2026-05-25).
--
-- Adiciona `kicker` (texto curto opcional acima do título da vitrine — ex:
-- "Top semana", "Promo junho") e `bg_color` (cor de fundo do card na home
-- — ex: "#174D44") na tabela storefront_collection.
--
-- Bate aparência dos cards "vt-vitrine-card" do handoff (home.jsx linha
-- 60), onde cada vitrine tem cor própria + kicker pra criar hierarquia
-- visual ("kicker pequeno em cima, título grande, meta menor embaixo").
--
-- Ambos nullable — coleções existentes continuam funcionando sem
-- migration de dados. CollectionStrip mostra fallback (cinza neutro,
-- sem kicker) quando ausente.

ALTER TABLE storefront_collection
  ADD COLUMN IF NOT EXISTS kicker text,
  ADD COLUMN IF NOT EXISTS bg_color text;

-- CHECK: bg_color deve ser hex válido ou NULL. Aceitamos 3-dig curto
-- (#abc) e 6-dig padrão (#aabbcc), case-insensitive.
ALTER TABLE storefront_collection
  ADD CONSTRAINT storefront_collection_bg_color_format
  CHECK (
    bg_color IS NULL
    OR bg_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'
  );

-- CHECK: kicker máximo 30 chars (UI quebra acima disso).
ALTER TABLE storefront_collection
  ADD CONSTRAINT storefront_collection_kicker_length
  CHECK (kicker IS NULL OR char_length(kicker) <= 30);
