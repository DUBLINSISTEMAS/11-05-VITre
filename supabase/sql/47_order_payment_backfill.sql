-- ADR-0034 Camada 1 — Backfill order_payment a partir das colunas
-- deprecated em "order".
--
-- Pra cada pedido existente com `payment_method NOT NULL` (= pedidos
-- balcão da Fase 5/ADR-0016), gera 1 linha em `order_payment` com
-- o método e o valor total efetivo da venda.
--
-- Idempotente — só insere onde NÃO existe ainda order_payment pro pedido.
-- Pode rodar múltiplas vezes sem duplicar.
--
-- Aplicar APÓS:
--   1. drizzle/0031_first_kitty_pryde.sql (cria tabela order_payment)
--   2. supabase/sql/44_camada_comercial_check_constraints.sql (CHECKs)
--   3. supabase/sql/46_camada_comercial_rls.sql (RLS)
--
-- Notas:
--   - RLS está habilitado em order_payment. Pra o backfill funcionar,
--     usar service_role ou bypassar via SET LOCAL no Supabase SQL Editor.
--   - Pedidos whatsapp com payment_method NULL não recebem linha
--     (combinação de pagamento fica no chat, fora do escopo).
--   - amount = total - discount + surcharge (mesma fórmula do app-layer).

INSERT INTO "order_payment" (store_id, order_id, method, amount_in_cents, cash_received_in_cents, created_at)
SELECT
  o.store_id,
  o.id AS order_id,
  o.payment_method AS method,
  GREATEST(
    0,
    o.total_in_cents
      - COALESCE(o.discount_in_cents, 0)
      + COALESCE(o.surcharge_in_cents, 0)
  ) AS amount_in_cents,
  CASE
    WHEN o.payment_method = 'cash' THEN o.cash_received_in_cents
    ELSE NULL
  END AS cash_received_in_cents,
  o.created_at
FROM "order" o
WHERE o.payment_method IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "order_payment" op WHERE op.order_id = o.id
  );

-- Verificação pós-backfill (rodar separadamente pra inspecionar):
--
-- SELECT
--   (SELECT COUNT(*) FROM "order" WHERE payment_method IS NOT NULL) AS pedidos_com_pagamento,
--   (SELECT COUNT(*) FROM "order_payment") AS linhas_order_payment,
--   (SELECT COUNT(DISTINCT order_id) FROM "order_payment") AS pedidos_unicos_em_order_payment;
--
-- Esperado: pedidos_com_pagamento == linhas_order_payment == pedidos_unicos_em_order_payment
