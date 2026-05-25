"use client";

/**
 * Sprint 4D — header da /admin/financeiro/receber.
 *
 * Client component porque precisa controlar o estado de abertura do
 * dialog "Lançar fiado avulso". H1/copy fica aqui pra evitar render
 * server + client conflict do dialog.
 */

import { HandCoinsIcon, PlusIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StandaloneReceivableDialog } from "@/components/admin/standalone-receivable-dialog";

export function ReceivablesHeader() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <>
      {/* S7 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub` (handoff stub-pages.jsx:53-58 "A receber"). Mantemos
          o ícone HandCoinsIcon inline (identificador visual útil pro fiado)
          + subtítulo explicativo do behavior caixa-automático que o handoff
          mock não conhecia. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="b3-page-title flex items-center gap-2">
            <HandCoinsIcon size={20} className="text-brand" aria-hidden />
            A receber (fiado)
          </h1>
          <p className="b3-page-sub">
            Vendas fiadas e empréstimos pendentes. Marcar como pago gera
            entrada automática no caixa aberto (quando houver sessão ativa).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/financeiro/receber/relatorio"
            prefetch
            className="b3-btn whitespace-nowrap"
            title="Gera relatório A4 imprimível com saldo de cada fiado"
          >
            <PrinterIcon size={14} />
            Imprimir
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="b3-btn b3-btn--cta whitespace-nowrap"
            title="Lance empréstimo, adiantamento ou débito histórico"
          >
            <PlusIcon size={14} />
            Lançar fiado avulso
          </button>
        </div>
      </div>

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
