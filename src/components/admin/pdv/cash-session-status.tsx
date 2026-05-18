"use client";

/**
 * Banner de status de caixa no topo do PDV (ADR-0022 D1).
 *
 * Estado fechado: card cinza + CTA "Abrir caixa" → modal OpenCashDialog.
 * Estado aberto: card brand wash + esperado + duração + link "Caixa".
 *
 * D1 (opt-in): mesmo com caixa fechado, PDV continua funcional —
 * vendas saem com cashSessionId=null (registro existe, mas fora do
 * Z formal).
 */

import { CalculatorIcon, LockOpenIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatBRL } from "@/lib/pricing";

import { OpenCashDialog } from "./open-cash-dialog";

interface CashSessionStatusActive {
  id: string;
  openedAt: Date;
  openingAmountInCents: number;
  expectedInCents: number;
  saleCount: number;
}

export function CashSessionStatus({
  active,
}: {
  active: CashSessionStatusActive | null;
}) {
  const [openDialog, setOpenDialog] = useState(false);

  if (!active) {
    return (
      <>
        <div className="border-line bg-bg-app flex items-center gap-3 rounded-[12px] border border-dashed p-3 sm:p-4">
          <div className="text-ink-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
            <LockOpenIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink-1 text-[13.5px] font-semibold">
              Caixa fechado
            </p>
            <p className="text-ink-4 text-[12px] leading-relaxed">
              As vendas vão sair sem vínculo de caixa formal. Abra um caixa
              pra registrar troco inicial, sangria e fechamento Z.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenDialog(true)}
            className="b3-btn b3-btn--cta b3-btn--sm shrink-0"
          >
            <PlusIcon size={13} aria-hidden /> Abrir caixa
          </button>
        </div>
        <OpenCashDialog open={openDialog} onOpenChange={setOpenDialog} />
      </>
    );
  }

  const openedAtMs = new Date(active.openedAt).getTime();
  const durationMin = Math.floor((Date.now() - openedAtMs) / 60_000);
  const durationLabel =
    durationMin < 60
      ? `${durationMin} min`
      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  return (
    <div className="border-brand-line bg-brand-wash flex flex-wrap items-center gap-3 rounded-[12px] border p-3 sm:p-4">
      <div className="bg-brand/10 text-brand flex size-9 shrink-0 items-center justify-center rounded-full">
        <CalculatorIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-1 text-[13.5px] font-semibold">
          Caixa aberto · há {durationLabel}
        </p>
        <p className="text-ink-4 text-[12px] leading-relaxed">
          Troco inicial {formatBRL(active.openingAmountInCents)} ·{" "}
          {active.saleCount}{" "}
          {active.saleCount === 1 ? "venda" : "vendas"} · esperado em dinheiro{" "}
          <span className="text-ink-1 mono font-medium">
            {formatBRL(active.expectedInCents)}
          </span>
        </p>
      </div>
      <Link
        href="/admin/pdv/caixa"
        prefetch
        className="b3-btn b3-btn--sm shrink-0"
      >
        Gerenciar caixa
      </Link>
    </div>
  );
}
