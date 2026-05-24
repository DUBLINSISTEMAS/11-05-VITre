"use client";

/**
 * Dialog rico de devolução — Sprint 2.1 + 2.2 (2026-05-22).
 *
 * Substitui o AlertDialog simples que existia em order-status-actions.tsx.
 * Cobre 3 cenários:
 *
 *   1. Devolução total ("tudo voltou") — comportamento original.
 *   2. Devolução parcial item-a-item — checkbox + qty por item, com
 *      saldo restante respeitado (qty original - qty já devolvida).
 *   3. Fluxo guiado de fiado pendente — quando a action retorna
 *      `errorCode='PENDING_RECEIVABLE'`, mostra mensagem clara com
 *      link pro fiado da venda. Lojista estorna lá e volta.
 *
 * UX:
 *   - Tab "Tudo" / "Alguns itens" no topo do dialog.
 *   - "Tudo" só pede motivo; total = order.totalInCents.
 *   - "Alguns itens" lista cada item com saldo disponível. Item sem
 *     saldo (já 100% devolvido) aparece desabilitado.
 *   - Total recalculado conforme lojista mexe nas quantidades.
 *   - Botão "Confirmar" desabilitado se: motivo curto, partial sem
 *     item selecionado, todos sem saldo.
 *
 * Recebe `items` carregados pelo OrderDetailDialog — não busca por si.
 */

import { Loader2Icon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { OrderDetailItem } from "@/actions/order/load-detail";
import { recordOrderReturn } from "@/actions/order/record-return";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface OrderReturnDialogProps {
  orderId: string;
  orderTotalInCents: number;
  items: OrderDetailItem[];
  /** Disabled enquanto a action de transição de status estiver rodando. */
  disabled?: boolean;
}

type Mode = "full" | "partial";

interface PartialLine {
  /** Default 0. */
  quantity: number;
  /** Default false. */
  enabled: boolean;
}

export function OrderReturnDialog({
  orderId,
  orderTotalInCents,
  items,
  disabled,
}: OrderReturnDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sprint 2.2 — guarda dados do fiado pendente quando action retorna
  // errorCode='PENDING_RECEIVABLE'. Renderiza tela secundária.
  const [pendingReceivable, setPendingReceivable] = useState<{
    receivableId: string;
    remainingInCents: number;
  } | null>(null);

  // Saldo disponível por item (qty original - qty já devolvida).
  const itemsWithAvailable = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        available: it.quantity - it.quantityReturned,
      })),
    [items],
  );

  const anyAvailable = itemsWithAvailable.some((it) => it.available > 0);

  // Map { orderItemId → { quantity, enabled } } pro modo partial.
  const [partialLines, setPartialLines] = useState<Record<string, PartialLine>>(
    {},
  );

  const partialTotal = useMemo(() => {
    let total = 0;
    for (const it of itemsWithAvailable) {
      const line = partialLines[it.id];
      if (!line || !line.enabled || line.quantity <= 0) continue;
      total += it.priceInCentsSnapshot * line.quantity;
    }
    return total;
  }, [itemsWithAvailable, partialLines]);

  const partialHasValidSelection = useMemo(() => {
    for (const it of itemsWithAvailable) {
      const line = partialLines[it.id];
      if (
        line?.enabled &&
        line.quantity > 0 &&
        line.quantity <= it.available
      ) {
        return true;
      }
    }
    return false;
  }, [itemsWithAvailable, partialLines]);

  const reset = () => {
    setMode("full");
    setReason("");
    setPartialLines({});
    setPendingReceivable(null);
  };

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      toast.error("Motivo precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (mode === "partial" && !partialHasValidSelection) {
      toast.error("Marque pelo menos um item e quantidade.");
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload =
        mode === "partial"
          ? itemsWithAvailable
              .filter((it) => {
                const l = partialLines[it.id];
                return l?.enabled && l.quantity > 0;
              })
              .map((it) => ({
                orderItemId: it.id,
                quantity: partialLines[it.id]!.quantity,
              }))
          : undefined;

      const result = await recordOrderReturn({
        orderId,
        returnType: mode,
        items: itemsPayload,
        reason: reason.trim(),
      });

      if (!result.ok) {
        // Sprint 2.2 — fiado pendente abre subtela guiada.
        if ("errorCode" in result && result.errorCode === "PENDING_RECEIVABLE") {
          setPendingReceivable({
            receivableId: result.receivableId,
            remainingInCents: result.remainingInCents,
          });
          return;
        }
        toast.error(result.error);
        return;
      }

      const tipo = result.returnType === "full" ? "" : "parcial ";
      const fechou = result.orderFullyReturned ? " A venda foi totalmente devolvida." : "";
      toast.success(
        result.cashAdjustmentId
          ? `Devolução ${tipo}registrada. Saída de ${formatBRL(result.refundedInCents)} no caixa.${fechou}`
          : `Devolução ${tipo}registrada.${fechou}`,
      );
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="text-state-warning hover:bg-state-warning/10 hover:text-state-warning"
        >
          <Undo2Icon /> Registrar devolução
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        {pendingReceivable ? (
          // --- Subtela Sprint 2.2: fiado pendente guiado --------------
          <>
            <DialogHeader>
              <DialogTitle>Fiado em aberto bloqueia devolução</DialogTitle>
              <DialogDescription>
                Esta venda tem <strong>{formatBRL(pendingReceivable.remainingInCents)}</strong>{" "}
                de fiado pendente. Estorne os pagamentos do fiado antes de
                registrar a devolução — a contabilidade da venda precisa estar
                fechada pra devolver com integridade.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-ink-2">
              <p>Como proceder:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Abra o fiado desta venda na tela de &quot;A receber&quot;.</li>
                <li>Estorne cada pagamento que recebeu (gera saída no caixa).</li>
                <li>Volte aqui e tente devolver de novo.</li>
              </ol>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingReceivable(null)}>
                Voltar
              </Button>
              <Button asChild>
                <Link href={`/admin/financeiro/receber?receivable=${pendingReceivable.receivableId}`}>
                  Abrir fiado
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          // --- Tela principal: full | partial --------------------------
          <>
            <DialogHeader>
              <DialogTitle>Registrar devolução</DialogTitle>
              <DialogDescription>
                Cliente trouxe produtos de volta. O estoque será restaurado
                automaticamente. Se houver caixa aberto, uma saída será lançada
                pelo valor devolvido.
              </DialogDescription>
            </DialogHeader>

            {/* Toggle Tudo / Alguns itens */}
            <div className="b3-tabs" role="tablist" aria-label="Tipo de devolução">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "full"}
                data-active={mode === "full" ? "true" : undefined}
                className="b3-tab"
                onClick={() => setMode("full")}
                disabled={submitting}
              >
                Devolver tudo
                <span className="ml-1.5 text-[10.5px] text-ink-4">
                  {formatBRL(orderTotalInCents)}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "partial"}
                data-active={mode === "partial" ? "true" : undefined}
                className="b3-tab"
                onClick={() => setMode("partial")}
                disabled={submitting || !anyAvailable}
                title={
                  !anyAvailable
                    ? "Sem itens com saldo pra devolver"
                    : undefined
                }
              >
                Alguns itens
              </button>
            </div>

            {mode === "partial" ? (
              <div className="max-h-[44vh] space-y-2 overflow-y-auto">
                {itemsWithAvailable.map((it) => {
                  const line = partialLines[it.id] ?? {
                    enabled: false,
                    quantity: 0,
                  };
                  const exhausted = it.available === 0;
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border border-line p-2.5 text-[12.5px]",
                        exhausted && "opacity-50",
                      )}
                    >
                      <Checkbox
                        id={`return-item-${it.id}`}
                        checked={line.enabled}
                        disabled={exhausted || submitting}
                        onCheckedChange={(checked) => {
                          setPartialLines((prev) => ({
                            ...prev,
                            [it.id]: {
                              enabled: checked === true,
                              quantity:
                                checked === true && line.quantity === 0
                                  ? it.available
                                  : line.quantity,
                            },
                          }));
                        }}
                      />
                      <label
                        htmlFor={`return-item-${it.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <p className="font-medium text-ink-1">
                          {it.productNameSnapshot}
                          {it.variantNameSnapshot ? (
                            <span className="text-ink-4 font-normal">
                              {" "}
                              · {it.variantNameSnapshot}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-ink-4 text-[11px]">
                          {formatBRL(it.priceInCentsSnapshot)} cada · vendido{" "}
                          {it.quantity}
                          {it.quantityReturned > 0
                            ? ` · já devolvido ${it.quantityReturned}`
                            : ""}
                          {" · "}saldo {it.available}
                        </p>
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={it.available}
                        step={1}
                        disabled={exhausted || !line.enabled || submitting}
                        value={line.enabled ? line.quantity : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          const clamped = Math.max(
                            0,
                            Math.min(it.available, Math.round(v)),
                          );
                          setPartialLines((prev) => ({
                            ...prev,
                            [it.id]: {
                              enabled: clamped > 0 ? true : prev[it.id]?.enabled ?? false,
                              quantity: clamped,
                            },
                          }));
                        }}
                        className="h-8 w-16 text-right tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="return-reason" required>
                Motivo
              </Label>
              <Textarea
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: produto com defeito, cliente arrependido…"
                maxLength={500}
                rows={2}
                disabled={submitting}
              />
              <p className="text-ink-4 text-[11px]">
                Mínimo 3 caracteres. Aparece em relatórios e auditoria.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md bg-bg-app px-3 py-2 text-[12.5px]">
              <span className="text-ink-3">Total a devolver</span>
              <span className="font-mono text-base font-semibold tabular-nums text-ink-1">
                {formatBRL(
                  mode === "full" ? orderTotalInCents : partialTotal,
                )}
              </span>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  reason.trim().length < 3 ||
                  (mode === "partial" && !partialHasValidSelection)
                }
                className="bg-state-warning text-white hover:bg-state-warning/90"
              >
                {submitting ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                    Registrando…
                  </>
                ) : (
                  "Confirmar devolução"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
