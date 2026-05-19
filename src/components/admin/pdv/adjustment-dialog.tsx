"use client";

/**
 * Dialog "Sangria" / "Reforço" (ADR-0022 D3).
 *
 * Form: valor (R$) + motivo livre. `type` é prop. UI muda labels e cor:
 *   - sangria: vermelho (saída)
 *   - reinforcement: amarelo (entrada extra)
 */

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordAdjustment } from "@/actions/cash-session/adjustment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Subset do CashAdjustmentType que este dialog cobre HOJE.
 * ADR-0034 Camada 1 estendeu o enum DB com `pay_supplier`, `pay_bill`,
 * `other_in`, `other_out` — UI desses 4 valores entra em Camada 4
 * (Caixa de verdade). Manter dialog atual restrito aos 2 antigos
 * evita undefined em CONFIG[type] em runtime.
 */
type AdjustmentDialogType = "sangria" | "reinforcement";

interface AdjustmentDialogProps {
  open: boolean;
  sessionId: string;
  type: AdjustmentDialogType;
  onOpenChange: (next: boolean) => void;
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

const CONFIG: Record<
  AdjustmentDialogType,
  { title: string; description: string; placeholder: string }
> = {
  sangria: {
    title: "Registrar sangria",
    description:
      "Retira dinheiro da gaveta pra cofre/banco. O valor sai do esperado no fechamento.",
    placeholder: "Ex: depósito no banco, troco do almoço…",
  },
  reinforcement: {
    title: "Registrar reforço",
    description:
      "Adiciona dinheiro ao caixa (de outro caixa, do bolso, troco extra). Entra no esperado.",
    placeholder: "Ex: pegou troco com a sócia, repôs trocado…",
  },
};

export function AdjustmentDialog({
  open,
  sessionId,
  type,
  onOpenChange,
}: AdjustmentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cfg = CONFIG[type];

  const reset = () => {
    setAmount("");
    setReason("");
    setError(null);
  };

  const submit = () => {
    const cents = inputToCents(amount);
    if (cents === null) {
      setError("Valor inválido. Use formato 0,00 (maior que zero).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordAdjustment({
        sessionId,
        type,
        amountInCents: cents,
        reason: reason.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.errorCode === "VALIDATION" && result.fieldErrors) {
          const msg =
            result.fieldErrors.amountInCents ?? result.fieldErrors.reason;
          if (msg) setError(msg);
        }
        return;
      }
      toast.success(type === "sangria" ? "Sangria registrada." : "Reforço registrado.");
      onOpenChange(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount" className="text-[12.5px]">
              Valor (R$)
            </Label>
            <Input
              id="adj-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              autoFocus
            />
            {error ? (
              <p className="text-destructive text-xs">{error}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason" className="text-[12.5px]">
              Motivo (opcional, recomendado)
            </Label>
            <Textarea
              id="adj-reason"
              rows={3}
              placeholder={cfg.placeholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
