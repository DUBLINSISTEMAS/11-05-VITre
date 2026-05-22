/**
 * Constantes compartilhadas do domínio "venda" (order).
 *
 * Sprint 1.3 (2026-05-22) — fim do drift entre KPI dashboard e
 * relatórios oficiais. Antes:
 *   - `actions/reports/load.ts` filtrava só `status <> canceled AND <> expired`
 *     → incluía quote + awaiting_whatsapp + returned no faturamento
 *   - `actions/reports/load-sales|top|margin|dre.ts` filtravam por
 *     `["confirmed", "fulfilled"]` (cada um redeclarava a constante)
 *   - `actions/order/record-return.ts` e `components/admin/order-status-actions.tsx`
 *     repetiam `["confirmed", "fulfilled"]` na mão pra decidir devolução
 *
 * Resultado: dashboard mostrava "faturamento R$X" maior que relatório
 * oficial. Esse arquivo é o único lugar canônico — qualquer mudança
 * de regra acontece aqui e propaga.
 *
 * Convenção: tuples `as const` pra TypeScript inferir tipos literais
 * exatos, e `OrderStatus` extraído do enum Drizzle.
 */
import type { Order } from "@/db/schema";

export type OrderStatus = Order["status"];

/**
 * Status que CONTAM no faturamento, ticket médio, CMV, top produtos
 * e margem.
 *
 * - `confirmed`: venda balcão fechada / pagamento confirmado no whatsapp
 * - `fulfilled`: venda entregue ao cliente
 *
 * Exclui:
 * - `quote`: orçamento (sem pagamento, sem desconto de estoque)
 * - `awaiting_whatsapp`: cliente clicou checkout mas lojista ainda
 *   não confirmou — venda pode nunca acontecer
 * - `canceled` / `expired`: venda não aconteceu
 * - `returned`: cliente trouxe de volta. A devolução em si é descontada
 *   via `order_return_item` nos loaders (Sprint 1.4) — a venda original
 *   sai da contagem porque o status mudou.
 */
export const COUNTABLE_STATUSES = ["confirmed", "fulfilled"] as const satisfies
  readonly OrderStatus[];

/**
 * Status que admitem devolução pelo fluxo de `recordOrderReturn`.
 *
 * `quote` e `canceled`/`expired` não devolvem (nada foi vendido).
 * `returned` bloqueia re-devolução (idempotência via UNIQUE INDEX
 * em order_return.order_id WHERE type='full').
 *
 * Reusado pelo botão "Devolver" no admin (order-status-actions.tsx).
 */
export const RETURNABLE_STATUSES = ["confirmed", "fulfilled"] as const satisfies
  readonly OrderStatus[];

/**
 * Status "em aberto" — venda em andamento que ainda pode virar
 * `confirmed` ou ser descartada.
 *
 * Usado por filtros de toolbar e badges de pendência. Não entra no
 * faturamento até virar `confirmed`.
 */
export const OPEN_STATUSES = ["quote", "awaiting_whatsapp"] as const satisfies
  readonly OrderStatus[];

// ===========================================================================
// Predicados — wrapping de Array.prototype.includes pra `OrderStatus` largo.
// Sem isso, .includes() em tuple `as const` rejeita strings amplas no
// TypeScript (literal vs union).
// ===========================================================================

export function isCountable(status: OrderStatus): boolean {
  return (COUNTABLE_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isReturnable(status: OrderStatus): boolean {
  return (RETURNABLE_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isOpen(status: OrderStatus): boolean {
  return (OPEN_STATUSES as readonly OrderStatus[]).includes(status);
}
