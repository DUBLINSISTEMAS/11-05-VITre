-- =====================================================================
-- Mangos Pay — Onda 2.15 (2026-05-22): product.allow_oversell
-- =====================================================================
-- CONTEXTO
-- CLAUDE.md glossário: "configurável: bloqueia ou só avisa" para estoque
-- zerado. Hoje o PDV sempre rejeita venda quando track_stock=true e saldo
-- chega a 0. Lojista que vende sob encomenda (joia personalizada, pré-venda)
-- precisa do oposto: aceitar venda + alertar.
--
-- Default false → comportamento atual preservado. ON requer marcação
-- explícita por produto.
--
-- DEPLOY
-- ADD COLUMN com default + NOT NULL em PostgreSQL 11+ é metadata-only
-- (não scaneia tabela). Seguro mesmo com milhões de linhas.
-- =====================================================================

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS allow_oversell boolean NOT NULL DEFAULT false;
