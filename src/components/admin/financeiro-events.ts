/**
 * Eventos globais da tela `/admin/financeiro` — Onda L2 (2026-05-29).
 *
 * Arquivo neutro (sem `"use client"`) pra que tanto Server quanto Client
 * Components possam importar a constante sem cruzar boundary.
 *
 * Quem dispara: CTAs "+ Lancar fiado" / "+ Lancar despesa" no
 * `FinanceiroOverview` (header centralizado).
 *
 * Quem escuta:
 *   - `ReceivablesPanel` -> abre StandaloneReceivableDialog (fiado avulso)
 *   - `ExpensesPageClient` em modo embedded -> abre form de nova despesa
 *
 * Por que evento e nao prop drilling: os dialogs sao state-heavy e cada um
 * vive proximo da sua propria lista (refresh de dados etc). Header so dispara
 * — quem segura a UI do dialog e quem ja tinha a lista.
 */
export const OPEN_NEW_RECEIVABLE_EVENT = "admin:open-new-receivable";
export const OPEN_NEW_EXPENSE_EVENT = "admin:open-new-expense";
