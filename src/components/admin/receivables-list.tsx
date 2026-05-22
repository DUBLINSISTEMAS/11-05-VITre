"use client";

/**
 * Sprint 2B + Sprint 4B.
 *
 * Lista de fiados pendentes. Cada linha mostra:
 *   - Vencimento + status (Vencido / Aberto / Parcial)
 *   - Cliente + telefone
 *   - Valor total + barra de progresso quando parcial
 *   - Botão "Receber pagamento" abre dialog (Sprint 4B)
 *
 * Cards de topo (Pendente / Vencido / Vincendos) já consideram
 * pagamentos parciais — vêm do server (loadPendingReceivables).
 */

import {
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  HandCoinsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PendingReceivableRow } from "@/actions/receivable/load-pending";
import { ReceivablePaymentDialog } from "@/components/admin/receivable-payment-dialog";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface ReceivablesListProps {
  rows: PendingReceivableRow[];
  totals: {
    pendingSum: number;
    overdueSum: number;
    overdueCount: number;
    pendingCount: number;
  };
}

export function ReceivablesList({ rows: initial, totals }: ReceivablesListProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Recálculo local (após pagamentos rápidos) — refresh do server cobre
  // o caso confirmado. Aqui derivamos os mesmos cards a partir dos rows
  // recebidos do server (que já consideram parciais).
  const localPendingSum = initial.reduce(
    (acc, r) => acc + r.remainingInCents,
    0,
  );
  const localOverdueSum = initial.reduce((acc, r) => {
    if (r.isOverdue) return acc + r.remainingInCents;
    return acc;
  }, 0);
  const localOverdueCount = initial.filter((r) => r.isOverdue).length;

  const openRow = initial.find((r) => r.id === openId) ?? null;

  if (initial.length === 0) {
    return (
      <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
        <div className="flex size-12 items-center justify-center rounded-full bg-ok-wash text-ok">
          <CheckCircle2Icon className="size-6" />
        </div>
        <h2 className="text-lg font-semibold text-ink-1">
          Nenhum fiado pendente
        </h2>
        <p className="text-ink-4 max-w-sm text-sm">
          Bom trabalho. Fiados novos aparecem aqui automaticamente quando
          você lança uma venda como fiado no PDV.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="b3-card b3-card-pad">
          <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Pendente
          </div>
          <div className="mono text-ink-1 mt-1 text-[22px] font-bold tabular-nums">
            {formatBRL(localPendingSum)}
          </div>
          <div className="text-ink-4 mt-1 text-[12px]">
            {initial.length} {initial.length === 1 ? "lançamento" : "lançamentos"}
          </div>
        </div>
        <div
          className={cn(
            "b3-card b3-card-pad",
            localOverdueSum > 0 && "border-danger/40",
          )}
        >
          <div
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.06em]",
              localOverdueSum > 0 ? "text-danger" : "text-ink-4",
            )}
          >
            Vencido
          </div>
          <div
            className={cn(
              "mono mt-1 text-[22px] font-bold tabular-nums",
              localOverdueSum > 0 ? "text-danger" : "text-ink-1",
            )}
          >
            {formatBRL(localOverdueSum)}
          </div>
          <div className="text-ink-4 mt-1 text-[12px]">
            {localOverdueCount}{" "}
            {localOverdueCount === 1 ? "lançamento" : "lançamentos"}
          </div>
        </div>
        <div className="b3-card b3-card-pad">
          <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Vincendos
          </div>
          <div className="mono text-ink-1 mt-1 text-[22px] font-bold tabular-nums">
            {formatBRL(localPendingSum - localOverdueSum)}
          </div>
          <div className="text-ink-4 mt-1 text-[12px]">
            {initial.length - localOverdueCount}{" "}
            {initial.length - localOverdueCount === 1
              ? "lançamento"
              : "lançamentos"}
          </div>
        </div>
      </div>

      <div className="b3-card overflow-x-auto">
        <table className="b3-tbl w-full">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Cliente</th>
              <th className="text-right">Saldo</th>
              <th>Status</th>
              <th>Venda</th>
              <th style={{ width: 160 }} />
            </tr>
          </thead>
          <tbody>
            {initial.map((r) => {
              const isPartial = r.paidInCents > 0;
              const paidPct =
                r.amountInCents === 0
                  ? 0
                  : Math.min(100, (r.paidInCents / r.amountInCents) * 100);
              return (
                <tr key={r.id}>
                  <td className="mono text-[12.5px]">
                    {r.dueDate
                      ? r.dueDate.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td>
                    <Link
                      href={`/admin/clientes/${r.customerId}`}
                      className="text-ink-1 hover:text-brand text-[13px]"
                      prefetch
                    >
                      {r.customerName}
                    </Link>
                    {r.customerPhone ? (
                      <div className="text-ink-4 mono text-[11px]">
                        {r.customerPhone}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-right">
                    <div className="mono font-medium tabular-nums">
                      {formatBRL(r.remainingInCents)}
                    </div>
                    {isPartial ? (
                      <>
                        <div className="text-ink-4 mt-0.5 text-[11px]">
                          de {formatBRL(r.amountInCents)}
                        </div>
                        <div className="bg-line/40 mt-1 h-1 w-full overflow-hidden rounded">
                          <div
                            className="bg-state-success h-full rounded"
                            style={{ width: `${paidPct}%` }}
                            aria-hidden
                          />
                        </div>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {r.isOverdue ? (
                      <span className="b3-pill b3-pill--danger inline-flex items-center gap-1">
                        <ClockIcon size={10} />
                        Vencido
                      </span>
                    ) : isPartial ? (
                      <span className="b3-pill b3-pill--brand inline-flex items-center gap-1">
                        <ClockIcon size={10} />
                        Parcial
                      </span>
                    ) : (
                      <span className="b3-pill b3-pill--warn inline-flex items-center gap-1">
                        <ClockIcon size={10} />
                        Aberto
                      </span>
                    )}
                  </td>
                  <td>
                    {r.orderId ? (
                      <Link
                        href={`/admin/pedidos?detail=${r.orderId}`}
                        className="text-ink-3 hover:text-brand inline-flex items-center gap-1 text-[12px]"
                        prefetch
                      >
                        <ExternalLinkIcon size={11} />
                        Ver
                      </Link>
                    ) : (
                      <span className="text-ink-4 text-[12px]">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        className="b3-btn b3-btn--sm b3-btn--brand"
                        title="Receber pagamento parcial ou total"
                      >
                        <HandCoinsIcon size={12} />
                        Receber
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openRow ? (
        <ReceivablePaymentDialog
          receivableId={openRow.id}
          initialRemainingInCents={openRow.remainingInCents}
          customerName={openRow.customerName}
          onClose={(didChange) => {
            setOpenId(null);
            if (didChange) {
              startTransition(() => {
                router.refresh();
              });
            }
          }}
        />
      ) : null}
    </>
  );
}
