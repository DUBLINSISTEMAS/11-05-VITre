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

import { AlertTriangleIcon, CalculatorIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
    // Onda 2.6 — banner amarelo proeminente (era cinza neutro). Sem
    // bloquear venda (decisão ADR-0022 D1 = opt-in), mas visualmente
    // impossível ignorar. Lojista que esquecer abrir caixa por 1 dia já
    // sentiu o aviso 50 vezes.
    return (
      <>
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[12px] border-2 p-3 sm:p-4"
          style={{
            borderColor: "var(--warn)",
            background: "var(--warn-wash)",
          }}
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--warn)", color: "white" }}
          >
            <AlertTriangleIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--warn)" }}>
              Caixa não foi aberto hoje
            </p>
            <p className="text-ink-1 text-[12px] leading-relaxed">
              Abra o caixa <strong>antes da primeira venda</strong> pra
              registrar troco inicial, sangria e poder fechar Z no fim do dia.
              Sem caixa aberto, as vendas saem soltas no relatório.
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

  // Audit 2026-05-21 — `Date.now()` causava hydration mismatch (server
  // renderiza em T1, client hidrata em T2, "X min" diferente). Solução
  // sênior: state inicial null → useEffect calcula no client após
  // mount → re-renderiza sem mismatch. Intervalo de 1min mantém a
  // duração atualizada em tempo real (lojista vê o número crescer).
  const openedAt = active.openedAt;
  const [durationLabel, setDurationLabel] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const openedAtMs = new Date(openedAt).getTime();
      const min = Math.floor((Date.now() - openedAtMs) / 60_000);
      setDurationLabel(
        min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`,
      );
    };
    compute();
    const interval = setInterval(compute, 60_000);
    return () => clearInterval(interval);
  }, [openedAt]);

  return (
    <div className="border-brand-line bg-brand-wash flex flex-wrap items-center gap-3 rounded-[12px] border p-3 sm:p-4">
      <div className="bg-brand/10 text-brand flex size-9 shrink-0 items-center justify-center rounded-full">
        <CalculatorIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-1 text-[13.5px] font-semibold">
          {/* Server e first-paint do client: "Caixa aberto" sem duração
              (durationLabel ainda null). Após useEffect mount no client,
              re-renderiza com "Caixa aberto · há 12 min" sem mismatch. */}
          Caixa aberto
          {durationLabel ? ` · há ${durationLabel}` : ""}
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
