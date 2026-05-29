"use client";

/**
 * ReceivablesPanel — Onda L2 (2026-05-29).
 *
 * Wrapper de `ReceivablesList` pra uso dentro da tela `/admin/financeiro`.
 * Escuta o evento `OPEN_NEW_RECEIVABLE_EVENT` disparado pelo CTA "+ Lancar
 * fiado" do header centralizado, e abre o StandaloneReceivableDialog.
 *
 * A rota antiga `/admin/financeiro/receber` usava o `ReceivablesHeader`
 * separado que ja tinha esse dialog. Em Onda L2 o header sumiu (vive em
 * FinanceiroOverview); este painel cobre o gap.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { PendingReceivableRow } from "@/actions/receivable/load-pending";
import { ReceivablesList } from "@/components/admin/receivables-list";
import { StandaloneReceivableDialog } from "@/components/admin/standalone-receivable-dialog";

import { OPEN_NEW_RECEIVABLE_EVENT } from "./financeiro-events";

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NEW_RECEIVABLE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NEW_RECEIVABLE_EVENT, onOpen);
  }, []);

  return (
    <>
      <ReceivablesList rows={rows} totals={totals} />
      {open ? (
        <StandaloneReceivableDialog
          onClose={(didCreate) => {
            setOpen(false);
            if (didCreate) {
              startTransition(() => router.refresh());
            }
          }}
        />
      ) : null}
    </>
  );
}
