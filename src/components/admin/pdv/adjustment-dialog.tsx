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
import {
  ADJUSTMENT_IS_OUT,
  ADJUSTMENT_LABEL_BR,
  type AdjustmentType,
} from "@/actions/cash-session/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * S3.5 (2026-05-26) — todos os 6 tipos de cash_adjustment_type.
 * Antes só `sangria` + `reinforcement` (Camada 4 ADR-0034 destrancou os 4
 * de pagamento que já estavam no schema).
 */
type AdjustmentDialogType = AdjustmentType;

interface AdjustmentDialogProps {
  open: boolean;
  sessionId: string;
  /** Tipo inicial; user pode trocar no Select. */
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
  { description: string; placeholder: string }
> = {
  sangria: {
    description:
      "Retira dinheiro da gaveta pra cofre/banco. O valor sai do esperado no fechamento.",
    placeholder: "Ex: depósito no banco, troco do almoço…",
  },
  reinforcement: {
    description:
      "Adiciona dinheiro ao caixa (de outro caixa, do bolso, troco extra). Entra no esperado.",
    placeholder: "Ex: pegou troco com a sócia, repôs trocado…",
  },
  pay_supplier: {
    description:
      "Pagamento direto ao fornecedor pelo caixa. Sai do esperado e vira despesa operacional no DRE.",
    placeholder: "Ex: pagou entrega de embalagem, mensalidade fornecedor…",
  },
  pay_bill: {
    description:
      "Pagamento de conta (luz, água, internet, conta da loja). Sai do esperado.",
    placeholder: "Ex: conta de luz, internet, IPTU…",
  },
  other_in: {
    description:
      "Entrada de dinheiro não categorizada (devolução de adiantamento, indenização, etc).",
    placeholder: "Ex: cliente devolveu cheque-presente, indenização…",
  },
  other_out: {
    description:
      "Saída de dinheiro não categorizada (vale-funcionário, almoço, outros).",
    placeholder: "Ex: vale-funcionário, almoço da equipe, presente cliente…",
  },
};

export function AdjustmentDialog({
  open,
  sessionId,
  type: initialType,
  onOpenChange,
}: AdjustmentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<AdjustmentDialogType>(initialType);
  const [error, setError] = useState<string | null>(null);

  const cfg = CONFIG[type];
  const isOut = ADJUSTMENT_IS_OUT[type];

  const reset = () => {
    setAmount("");
    setReason("");
    setType(initialType);
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
      toast.success(`${ADJUSTMENT_LABEL_BR[type]} registrada.`);
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
          <DialogTitle>
            Movimentar caixa
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isOut
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {isOut ? "Saída" : "Entrada"}
            </span>
          </DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="adj-type" className="text-[12.5px]">
              Tipo
            </Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as AdjustmentDialogType)}
              disabled={isPending}
            >
              <SelectTrigger id="adj-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(CONFIG) as Array<keyof typeof CONFIG>
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ADJUSTMENT_LABEL_BR[key]}
                    <span className="text-ink-4 ml-2 text-[10px]">
                      {ADJUSTMENT_IS_OUT[key] ? "saída" : "entrada"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
