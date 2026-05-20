-- Fix bug — CHECK obsoleto bloqueando orçamento + fiado + fiado 100%.
--
-- Bug encontrado 2026-05-21 durante investigação reportada pelo Anderson:
-- "Salvar como orçamento" e "Lançar como fiado" dão erro genérico
-- ("Falha ao registrar fiado/orçamento") porque o INSERT em "order"
-- viola este CHECK:
--
--   CHECK ((channel <> 'balcao') OR (payment_method IS NOT NULL))
--
-- Criado quando PDV só tinha mode='sale' com pagamento direto. Mas:
--   - Sprint 1A Fase 4: orçamento (mode='quote') insere paymentMethod=null
--   - Sprint 1A Fase 5: fiado clássico (mode='fiado') insere paymentMethod=null
--   - Sprint 4C: fiado 100% (creditAmount=total) também
--
-- Esse CHECK virou OBSOLETO desde Sprint 1A multipayment — order.payment_method
-- virou campo LEGADO; a verdade financeira está em order_payment (vendas pagas)
-- + receivable (fiados). Validação real fica no app-layer (action).
--
-- DROP é seguro porque:
--   1. Vendas confirmadas pagas têm linha(s) em order_payment
--   2. Vendas fiadas têm linha em receivable
--   3. Orçamentos têm status='quote' (sem dinheiro, intencional)
--   4. Devoluções têm status='returned' (sem dinheiro, intencional)
--
-- Idempotente.

ALTER TABLE "order"
  DROP CONSTRAINT IF EXISTS order_balcao_requires_payment_method;
