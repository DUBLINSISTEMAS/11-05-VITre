"use client";

/**
 * ReceivablesPanel — Onda L2 (2026-05-29), refatorado em R5 (2026-05-29).
 *
 * Wrapper de `ReceivablesList` pra uso dentro da tela `/admin/financeiro`.
 *
 * Onda R5 — Listener do OPEN_NEW_RECEIVABLE_EVENT MOVIDO pra
 * FinanceiroDialogsHost (vive sempre montado, qualquer tab). Founder
 * reportou que dialogs nao abriam quando estava na tab errada.
 *
 * Panel agora e thin wrapper. Mantido como componente proprio pra
 * preservar API caller-side e permitir extensoes futuras (badges,
 * filtros, etc) sem mexer no caller.
 */

import type { PendingReceivableRow } from "@/actions/receivable/load-pending";
import { ReceivablesList } from "@/components/admin/receivables-list";

interface ReceivablesPanelProps {
  rows: PendingReceivableRow[];
  totals: {
    pendingSum: number;
    overdueSum: number;
    overdueCount: number;
    pendingCount: number;
  };
}

export function ReceivablesPanel({ rows, totals }: ReceivablesPanelProps) {
  return <ReceivablesList rows={rows} totals={totals} />;
}
