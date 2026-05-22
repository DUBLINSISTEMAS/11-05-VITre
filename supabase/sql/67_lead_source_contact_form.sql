-- =====================================================================
-- Mangos Pay — Sprint 5.2 (2026-05-22): lead_source ganha 'contact_form'
-- =====================================================================
-- CONTEXTO
-- Lead foi originalmente criado como "intenção de compra" (cliente
-- clica WA no PDP/sacola). Sprint 5.2 abre formulário público
-- /[storeSlug]/contato pra recados não-comerciais ("vocês fazem
-- entrega no bairro X?", "qual o horário sábado?"). Mesma tabela,
-- novo source.
--
-- DEPLOY
-- ALTER TYPE ... ADD VALUE precisa rodar FORA de transação. SQL
-- Editor do Supabase aceita. IF NOT EXISTS = idempotente.
-- =====================================================================

ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'contact_form';
