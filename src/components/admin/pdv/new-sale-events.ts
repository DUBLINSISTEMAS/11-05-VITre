/**
 * Eventos globais do fluxo de Nova venda.
 *
 * Arquivo neutro (sem `"use client"`) pra que tanto Server Components
 * quanto Client Components possam importar a string da chave sem cruzar
 * boundary — Next 15/Turbopack engasga em HMR quando consts cruzam
 * boundary client/server (handoff 2026-05-25).
 *
 * Quem dispara: CTA verde "Nova venda" do topbar, tecla F2 global.
 * Quem escuta: <NewSaleModalListener /> montado em admin-shell.
 */
export const NEW_SALE_EVENT = "admin:open-new-sale";
