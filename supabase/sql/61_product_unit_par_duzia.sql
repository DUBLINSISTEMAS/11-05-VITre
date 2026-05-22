-- =====================================================================
-- Mangos Pay — Onda 2.10 (2026-05-22): glossário de estoque do CLAUDE.md.
-- Enum `product_unit` ganha 'par' e 'duzia' (em PT-BR sem cedilha pra
-- evitar surpresa de encoding em ferramentas). Display em UI é "dúzia".
-- =====================================================================
-- CONTEXTO
-- CLAUDE.md → "Unidade (select: un, kg, g, m, m², L, ml, par, dúzia)".
-- O enum atual (`un, pc, kg, g, m, cm, ml, L, m2, m3`) não tem `par`/`duzia`
-- e tem 3 valores fora do glossário (`pc, cm, m3`). Removeremos esses 3 do
-- SELECT da UI mas mantemos no enum pra preservar produtos legados —
-- DROP VALUE em pg-enum requer recriar coluna + tipo, custo alto pra
-- ganho zero.
--
-- DEPLOY
-- ALTER TYPE ... ADD VALUE precisa rodar FORA de transação. Use o SQL
-- Editor do Supabase. PostgreSQL ignora ADD VALUE duplicado quando
-- IF NOT EXISTS — idempotente.
--
-- DEPENDÊNCIA
-- Schema TS (`productUnitEnum`) e Zod (`productUnitSchema`) atualizados
-- no mesmo commit pra match.
-- =====================================================================

ALTER TYPE product_unit ADD VALUE IF NOT EXISTS 'par';
ALTER TYPE product_unit ADD VALUE IF NOT EXISTS 'duzia';
