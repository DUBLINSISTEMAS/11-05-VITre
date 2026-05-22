-- =====================================================================
-- Mangos Pay — Sprint 3.5 (2026-05-22): store.require_open_cash_session
-- =====================================================================
-- CONTEXTO
-- Hoje (Onda 2.6) o PDV mostra banner amarelo "Sem caixa aberto" quando
-- o lojista tenta vender sem cash_session ativa, mas NÃO bloqueia. Vendas
-- continuam registrando sem cash_session_id — viram "vendas órfãs" no
-- fechamento Z (sem entrada explícita no caixa).
--
-- Setting opcional: lojista decide se quer "modo apertado" (PDV bloqueia
-- sem caixa) ou "modo solto" (atual — só avisa). Default false preserva
-- comportamento atual; lojista ativa em /admin/configuracoes quando
-- quiser disciplina.
--
-- DEPLOY
-- ADD COLUMN com NOT NULL DEFAULT false é metadata-only no PostgreSQL
-- 11+ (não scaneia tabela). Seguro mesmo com milhares de lojas.
-- =====================================================================

ALTER TABLE store
  ADD COLUMN IF NOT EXISTS require_open_cash_session boolean NOT NULL DEFAULT false;
