"use client";

/**
 * Dialog "Abrir caixa" (ADR-0022).
 *
 * Form simples: troco inicial em R$. Submit chama openCashSession.
 * Sucesso: fecha modal + router.refresh() pra atualizar banner.
 */

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { openCashSession } from "@/actions/cash-session/open";
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

interface OpenCashDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /**
   * Bloco B UX (2026-05-28) — quando passado, NÃO chama router.refresh()
   * (que recarregaria a página e fecharia modais com state local — ex:
   * PDV com carrinho aberto). Caller atualiza state local no lugar.
   */
  onSuccess?: () => void;
}

/** "12,34" → 1234. "" → 0. Inválido → null. */
function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function OpenCashDialog({
  open,
  onOpenChange,
  onSuccess,
}: OpenCashDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cents = inputToCents(amount);
    if (cents === null) {
      setError("Valor inválido. Use formato 0,00.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await openCashSession({ openingAmountInCents: cents });
      if (!result.ok) {
        toast.error(result.error);
        if (result.errorCode === "VALIDATION" && result.fieldErrors) {
          const msg = result.fieldErrors.openingAmountInCents;
          if (msg) setError(msg);
        }
        return;
      }
      toast.success("Caixa aberto.");
      onOpenChange(false);
      setAmount("");
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>
            Informe o troco inicial em dinheiro. Esse valor entra como saldo
            de abertura e participa do cálculo de fechamento Z.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="opening-amount" className="text-[12.5px]">
            Troco inicial (R$)
          </Label>
          <Input
            id="opening-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          {error ? (
            <p className="text-destructive text-xs">{error}</p>
          ) : (
            <p className="text-ink-4 text-[11px]">
              Pode deixar 0,00 se abrir o caixa sem trocado.
            </p>
          )}
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
                <Loader2Icon className="animate-spin" /> Abrindo…
              </>
            ) : (
              "Abrir caixa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
