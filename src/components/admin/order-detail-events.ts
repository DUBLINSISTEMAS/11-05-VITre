/**
 * Eventos globais do drawer de detalhe da venda.
 *
 * Arquivo neutro (sem `"use client"`) pra que tanto Server Components
 * quanto Client Components possam importar a constante sem cruzar boundary
 * (Next 15/Turbopack engasga em HMR quando consts cruzam `"use client"`).
 *
 * Quem dispara: row da OrdersTable em /admin/pedidos, link "Vendas
 * recentes" no dashboard, qualquer outro ponto que precise abrir a
 * venda em qualquer rota do admin sem navegar.
 *
 * Quem escuta: `<OrderDetailDrawerListener />` montado em admin-shell.
 *
 * Payload: orderId via CustomEvent.detail. Sintaxe:
 *
 *     window.dispatchEvent(
 *       new CustomEvent(OPEN_ORDER_DETAIL_EVENT, {
 *         detail: { orderId: "xyz" }
 *       })
 *     );
 */
export const OPEN_ORDER_DETAIL_EVENT = "admin:open-order-detail";

export interface OpenOrderDetailEventDetail {
  orderId: string;
}
