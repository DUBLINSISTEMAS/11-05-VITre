"use client";

/**
 * OrderConfirmPaymentDialog — Onda 36 (2026-05-28).
 *
 * Dialog pra registrar pagamento de venda WhatsApp que foi criada sem
 * order_payment. Fecha o gap descoberto na Onda 35-36: checkout
 * WhatsApp NÃO grava forma de pagamento (cliente paga fora), então
 * DRE/dashboard fica cego pro canal.
 *
 * UX:
 *   - 1 linha por padrão (cobre 90% dos casos — PIX integral).
 *   - "+ Adicionar forma" suporta até 5 linhas (pra entregas onde
 *     cliente paga metade PIX, metade dinheiro etc).
 *   - Soma das linhas tem que bater com totalInCents — botão "Registrar"
 *     desabilitado até bater. Mostra diferença em tempo real.
 *   - method=credit revela input de parcelas (1-24).
 *   - method=cash revela input "Recebido" opcional pra calcular troco.
 *
 * Quando method ∈ {credit, debit}, server grava card_fee_snapshot via
 * computeCardFeeSnapshot (não exposto no form — taxa real da loja).
 * Igualmente settlement_date.
 */

import { Loader2Icon, PlusIcon, TrashIcon, WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { PAYMENT_METHOD_VALUES } from "@/actions/order/balcao/schema";
import { confirmOrderPayment } from "@/actions/order/confirm-payment";
import { updateOrderStatus } from "@/actions/order/update-status";
import { PriceInput } from "@/components/admin/price-input";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/pricing";

type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  other: "Outro (TED/DOC/Vale)",
};

interface PaymentLineDraft {
  method: PaymentMethod;
  /** Cents. null = vazio. */
  amountInCents: number | null;
  /** Cents. Só relevante em method='cash'. null = lojista não informou troco. */
  cashReceivedInCents: number | null;
  /** Default 1. Range 1..24 (CHECK no SQL 70). Só edita quando credit. */
  installments: number;
  notes: string;
}

function emptyLine(method: PaymentMethod = "pix"): PaymentLineDraft {
  return {
    method,
    amountInCents: null,
    cashReceivedInCents: null,
    installments: 1,
    notes: "",
  };
}

interface OrderConfirmPaymentDialogProps {
  orderId: string;
  totalInCents: number;
  /** Quando true, abre disabled — usado enquanto outra action roda. */
  disabled?: boolean;
  /**
   * Bloco B UX (2026-05-28) — quando true, após registrar pagamento
   * o dialog também confirma o status pra 'confirmed' na mesma ação.
   * Usado pra vendas WhatsApp em 'awaiting_whatsapp': lojista clica UM
   * botão e fecha venda + pagamento de uma vez (antes eram 2 cliques
   * em lugares diferentes do drawer, lojista esquecia o segundo).
   */
  confirmStatusAfter?: boolean;
}

export function OrderConfirmPaymentDialog({
  orderId,
  totalInCents,
  disabled,
  confirmStatusAfter = false,
}: OrderConfirmPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<PaymentLineDraft[]>([emptyLine("pix")]);
  const [isPending, startTransition] = useTransition();

  const sum = useMemo(
    () => lines.reduce((acc, l) => acc + (l.amountInCents ?? 0), 0),
    [lines],
  );
  const diff = totalInCents - sum;
  const sumMatches = diff === 0 && lines.every((l) => (l.amountInCents ?? 0) > 0);

  // Reset ao fechar — sem isso, reabrir o dialog mantém o último input.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setLines([emptyLine("pix")]);
    }
  };

  const updateLine = (i: number, patch: Partial<PaymentLineDraft>) => {
    setLines((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i]!, ...patch };
      // method != cash zera cashReceivedInCents
      if (patch.method && patch.method !== "cash") {
        next[i] = { ...next[i]!, cashReceivedInCents: null };
      }
      // method != credit volta installments pra 1
      if (patch.method && patch.method !== "credit") {
        next[i] = { ...next[i]!, installments: 1 };
      }
      return next;
    });
  };

  const addLine = () => {
    if (lines.length >= 5) return;
    // Sugere amount = restante a pagar pra acelerar UX.
    const remaining = Math.max(0, totalInCents - sum);
    setLines((prev) => [
      ...prev,
      { ...emptyLine("cash"), amountInCents: remaining > 0 ? remaining : null },
    ]);
  };

  const removeLine = (i: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    if (!sumMatches || isPending) return;

    startTransition(async () => {
      const payments = lines.map((l) => ({
        method: l.method,
        amountInCents: l.amountInCents!,
        cashReceivedInCents:
          l.method === "cash" && l.cashReceivedInCents !== null
            ? l.cashReceivedInCents
            : null,
        installments: l.installments,
        notes: l.notes.trim() === "" ? null : l.notes.trim(),
      }));

      const result = await confirmOrderPayment({ orderId, payments });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Bloco B UX — quando vem de awaiting_whatsapp, confirma status na
      // mesma ação. Falha aqui é não-fatal: pagamento já gravou, lojista
      // pode confirmar depois manualmente. Loga toast warning não-bloqueante.
      if (confirmStatusAfter) {
        const statusRes = await updateOrderStatus({
          orderId,
          nextStatus: "confirmed",
        });
        if (!statusRes.ok) {
          toast.warning(
            `Pagamento registrado, mas falhou confirmar status: ${statusRes.error}`,
          );
          setOpen(false);
          router.refresh();
          return;
        }
        toast.success("Venda confirmada e pagamento registrado.");
      } else {
        toast.success("Pagamento registrado.");
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          <WalletIcon className="h-3.5 w-3.5" aria-hidden />
          {confirmStatusAfter
            ? "Confirmar venda e registrar pagamento"
            : "Registrar pagamento"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Total da venda: <b>{formatBRL(totalInCents)}</b>. Informe como o
            cliente pagou — a taxa do cartão e a data de quitação são
            calculadas a partir das configurações da loja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lines.map((line, i) => (
            <div
              key={i}
              className="rounded-lg border border-line bg-bg-app/40 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-ink-3 text-[11px] font-semibold uppercase tracking-wide">
                  Forma {i + 1}
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-ink-4 hover:text-destructive inline-flex items-center gap-1 text-[11.5px]"
                  >
                    <TrashIcon className="h-3 w-3" aria-hidden />
                    Remover
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`method-${i}`}>Método</Label>
                  <Select
                    value={line.method}
                    onValueChange={(v) =>
                      updateLine(i, { method: v as PaymentMethod })
                    }
                  >
                    <SelectTrigger id={`method-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_VALUES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`amount-${i}`}>Valor</Label>
                  <PriceInput
                    id={`amount-${i}`}
                    value={line.amountInCents}
                    onChange={(v) => updateLine(i, { amountInCents: v })}
                  />
                </div>
              </div>

              {line.method === "credit" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`installments-${i}`}>Parcelas</Label>
                  <Select
                    value={String(line.installments)}
                    onValueChange={(v) =>
                      updateLine(i, { installments: Number(v) })
                    }
                  >
                    <SelectTrigger id={`installments-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map(
                        (n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}×{" "}
                            {n === 1
                              ? "à vista"
                              : line.amountInCents !== null
                                ? `de ${formatBRL(Math.floor(line.amountInCents / n))}`
                                : ""}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {line.method === "cash" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`received-${i}`}>
                    Recebido{" "}
                    <span className="text-ink-4 font-normal">(pra troco)</span>
                  </Label>
                  <PriceInput
                    id={`received-${i}`}
                    value={line.cashReceivedInCents}
                    onChange={(v) =>
                      updateLine(i, { cashReceivedInCents: v })
                    }
                    placeholder="Deixe vazio se não houve troco"
                  />
                  {line.cashReceivedInCents !== null &&
                  line.amountInCents !== null &&
                  line.cashReceivedInCents > line.amountInCents ? (
                    <p className="text-ink-3 text-[11.5px]">
                      Troco:{" "}
                      <b>
                        {formatBRL(
                          line.cashReceivedInCents - line.amountInCents,
                        )}
                      </b>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor={`notes-${i}`} className="text-[11.5px]">
                  Observação{" "}
                  <span className="text-ink-4 font-normal">(opcional)</span>
                </Label>
                <Input
                  id={`notes-${i}`}
                  value={line.notes}
                  onChange={(e) => updateLine(i, { notes: e.target.value })}
                  placeholder='Ex: "PIX banco X", "vale presente #42"'
                  maxLength={60}
                />
              </div>
            </div>
          ))}

          {lines.length < 5 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" aria-hidden />
              Adicionar outra forma
            </Button>
          ) : null}

          <div className="rounded-lg border border-line bg-bg-app/60 p-3">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-ink-3">Total informado</span>
              <span className="mono font-semibold tabular-nums">
                {formatBRL(sum)}
              </span>
            </div>
            <div className="text-ink-3 mt-1 flex items-center justify-between text-[12.5px]">
              <span>Total da venda</span>
              <span className="mono tabular-nums">{formatBRL(totalInCents)}</span>
            </div>
            {diff !== 0 ? (
              <div
                className={`mono mt-1 flex items-center justify-between text-[12.5px] font-semibold tabular-nums ${
                  diff > 0 ? "text-state-warning" : "text-destructive"
                }`}
              >
                <span>{diff > 0 ? "Falta" : "Excede em"}</span>
                <span>{formatBRL(Math.abs(diff))}</span>
              </div>
            ) : (
              <div className="text-state-success mt-1 text-[11.5px] font-medium">
                ✓ Soma bate com o total da venda
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!sumMatches || isPending}
          >
            {isPending ? (
              <>
                <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Registrando…
              </>
            ) : (
              "Registrar pagamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
