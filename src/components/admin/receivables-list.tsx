"use client";

import { CheckIcon, ClockIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { PendingReceivableRow } from "@/actions/receivable/load-pending";
import { markReceivablePaid } from "@/actions/receivable/mark-paid";
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
  const [rows, setRows] = useState(initial);
  const [marking, setMarking] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const localPendingSum = rows.reduce((acc, r) => acc + r.amountInCents, 0);
  const localOverdueSum = rows.reduce((acc, r) => {
    if (r.isOverdue) return acc + r.amountInCents;
    return acc;
  }, 0);
  const localOverdueCount = rows.filter((r) => r.isOverdue).length;

  function handleMarkPaid(id: string) {
    if (marking.has(id)) return;
    setMarking((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const result = await markReceivablePaid({ id });
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.cashAdjustmentId
          ? "Pago. Entrada registrada no caixa aberto."
          : "Pago. (Sem caixa aberto — só o fiado foi quitado.)",
      );
      setRows((prev) => prev.filter((r) => r.id !== id));
    });
  }

  if (initial.length === 0) {
    return (
      <div className="b3-card b3-card-pad text-center">
        <p className="text-ink-3 text-[13px]">
          Nenhum fiado pendente. Bom trabalho.
        </p>
        <p className="text-ink-4 mt-1 text-[12px]">
          Fiados novos aparecem aqui quando você lança uma venda como fiado no PDV.
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
            {rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}
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
            {rows.length - localOverdueCount}{" "}
            {rows.length - localOverdueCount === 1
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
              <th className="text-right">Valor</th>
              <th>Status</th>
              <th>Pedido</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMarking = marking.has(r.id);
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
                  <td className="mono text-right font-medium tabular-nums">
                    {formatBRL(r.amountInCents)}
                  </td>
                  <td>
                    {r.isOverdue ? (
                      <span className="b3-pill b3-pill--danger inline-flex items-center gap-1">
                        <ClockIcon size={10} />
                        Vencido
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
                        href={`/admin/pedidos?q=${r.orderId.slice(0, 8)}`}
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
                        onClick={() => handleMarkPaid(r.id)}
                        disabled={isMarking}
                        className="b3-btn b3-btn--sm b3-btn--brand"
                        title="Marcar como pago"
                      >
                        {isMarking ? (
                          "…"
                        ) : (
                          <>
                            <CheckIcon size={12} />
                            Marcar pago
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
