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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-ink-1 flex items-center gap-2 text-[22px] font-bold tracking-[-0.025em]">
            <HandCoinsIcon size={20} className="text-brand" />
            A receber (fiado)
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
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
