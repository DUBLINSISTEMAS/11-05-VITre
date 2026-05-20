"use client";

import { CheckIcon, ClockIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type {
  CustomerFiadoSummary,
  CustomerReceivableRow,
} from "@/actions/customer/types";
import { markReceivablePaid } from "@/actions/receivable/mark-paid";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface CustomerFiadoCardProps {
  summary: CustomerFiadoSummary;
  pendingReceivables: CustomerReceivableRow[];
}

export function CustomerFiadoCard({
  summary,
  pendingReceivables: initial,
}: CustomerFiadoCardProps) {
  const [pending, setPending] = useState(initial);
  const [marking, setMarking] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const localPendingSum = pending.reduce((acc, r) => acc + r.amountInCents, 0);
  const localOverdueSum = pending.reduce((acc, r) => {
    if (r.dueDate && r.dueDate < new Date()) {
      return acc + r.amountInCents;
    }
    return acc;
  }, 0);

  if (summary.pendingCount === 0 && pending.length === 0) {
    return (
      <section className="b3-card b3-card-pad">
        <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Saldo fiado
        </div>
        <p className="text-ink-3 mt-2 text-sm">
          Este cliente não tem fiado pendente.
        </p>
      </section>
    );
  }

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
      setPending((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <section className="b3-card b3-card-pad space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
          Saldo fiado
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-ink-4">
            {pending.length} {pending.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-line bg-bg-app p-3">
          <div className="text-ink-4 text-[11px]">Pendente</div>
          <div className="mono text-ink-1 mt-1 text-[20px] font-bold tabular-nums">
            {formatBRL(localPendingSum)}
          </div>
        </div>
        <div
          className={cn(
            "rounded-[10px] border p-3",
            localOverdueSum > 0
              ? "border-danger/40 bg-danger/5"
              : "border-line bg-bg-app",
          )}
        >
          <div
            className={cn(
              "text-[11px]",
              localOverdueSum > 0 ? "text-danger" : "text-ink-4",
            )}
          >
            Vencido
          </div>
          <div
            className={cn(
              "mono mt-1 text-[20px] font-bold tabular-nums",
              localOverdueSum > 0 ? "text-danger" : "text-ink-1",
            )}
          >
            {formatBRL(localOverdueSum)}
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="border-line -mx-4 border-t sm:-mx-5">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const now = new Date();
                const overdue = r.dueDate && r.dueDate < now;
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
                    <td className="mono text-right font-medium tabular-nums">
                      {formatBRL(r.amountInCents)}
                    </td>
                    <td>
                      {overdue ? (
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
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(r.id)}
                          disabled={isMarking}
                          className="b3-btn b3-btn--sm"
                          title="Marcar como pago"
                        >
                          {isMarking ? (
                            "Salvando…"
                          ) : (
                            <>
                              <CheckIcon size={12} />
                              Pago
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
      ) : null}

      <p className="text-ink-4 text-[11px]">
        Quando há caixa aberto, marcar como pago também registra entrada
        automática (cash_adjustment type=other_in) no fechamento Z.
      </p>
    </section>
  );
}
