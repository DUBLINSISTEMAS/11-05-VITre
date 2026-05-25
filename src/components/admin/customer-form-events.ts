/**
 * Eventos globais do CustomerFormDrawer — handoff PP2 (2026-05-25).
 *
 * Arquivo neutro (sem `"use client"`) pra cruzar boundary client/server
 * sem HMR engasgar — mesmo padrão de order-detail-events.ts,
 * new-sale-events.ts, product-form-events.ts.
 *
 * Quem dispara:
 *   - Row da CustomersTable em /admin/clientes
 *   - Botão "+ Adicionar cliente" do header + EmptyState
 *   - Quick action "Novo cliente" do Cmd+K palette (pendente)
 *
 * Quem escuta: `<CustomerFormDrawerListener />` montado em admin-shell.
 *
 * Payload: customerId via CustomEvent.detail. `null` = modo novo.
 */
export const OPEN_CUSTOMER_FORM_EVENT = "admin:open-customer-form";

export interface OpenCustomerFormEventDetail {
  /** UUID do cliente pra editar. `null` = abrir form vazio (novo). */
  customerId: string | null;
}
