"use client";

/**
 * Dialog "Fechar caixa" (ADR-0022 D5).
 *
 * Mostra esperado calculado server-side (passado via prop), recebe
 * contagem física do lojista, calcula diferença em tempo real e exige
 * `closingNotes` se diferença ≠ 0.
 *
 * Aceita qualquer diferença (não bloqueia) — campo notes vira obrigatório
 * só quando há divergência.
 */

import { Loader2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { closeCashSession } from "@/actions/cash-session/close";
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
import { formatBRL } from "@/lib/pricing";

interface CloseCashDialogProps {
  open: boolean;
  sessionId: string;
  expectedInCents: number;
  onOpenChange: (next: boolean) => void;
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function CloseCashDialog({
  open,
  sessionId,
  expectedInCents,
  onOpenChange,
}: CloseCashDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actualCents = inputToCents(actual);
  const delta = actualCents !== null ? actualCents - expectedInCents : null;
  const hasDelta = delta !== null && delta !== 0;

  const reset = () => {
    setActual("");
    setNotes("");
    setError(null);
  };

  const submit = () => {
    if (actualCents === null) {
      setError("Informe a contagem física (R$).");
      return;
    }
    if (hasDelta && notes.trim() === "") {
      setError("Diferença detectada — descreva o motivo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await closeCashSession({
        sessionId,
        closingActualInCents: actualCents,
        closingExpectedInCents: expectedInCents,
        closingNotes: notes.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.errorCode === "VALIDATION" && result.fieldErrors) {
          const msg =
            result.fieldErrors.closingNotes ??
            result.fieldErrors.closingActualInCents;
          if (msg) setError(msg);
        }
        return;
      }
      toast.success("Caixa fechado.");
      onOpenChange(false);
      reset();
      // Redirect pro Z page
      router.push(`/admin/pdv/caixa/${sessionId}`);
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
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>
            Conte o dinheiro físico e informe o valor real na gaveta.
            Vamos comparar com o esperado calculado pelo sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="bg-bg-app space-y-2 rounded-[10px] p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-4">Esperado (sistema)</span>
              <span className="mono text-ink-1 font-semibold">
                {formatBRL(expectedInCents)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-4">Contado (físico)</span>
              <span className="mono text-ink-1 font-semibold">
                {actualCents !== null ? formatBRL(actualCents) : "—"}
              </span>
            </div>
            <div className="border-line border-t pt-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-4">Diferença</span>
                <span
                  className={`mono font-semibold ${
                    delta === null
                      ? "text-ink-4"
                      : delta === 0
                        ? "text-ok"
                        : delta > 0
                          ? "text-warn"
                          : "text-danger"
                  }`}
                >
                  {delta === null
                    ? "—"
                    : delta === 0
                      ? "OK"
                      : (delta > 0 ? "+" : "−") + formatBRL(Math.abs(delta))}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="close-actual" className="text-[12.5px]">
              Contagem física (R$)
            </Label>
            <Input
              id="close-actual"
              inputMode="decimal"
              placeholder="0,00"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="close-notes" className="text-[12.5px]">
              Observações
              {hasDelta ? (
                <span className="text-destructive ml-0.5">*</span>
              ) : (
                <span className="text-ink-4 ml-1 text-[11px]">(opcional)</span>
              )}
            </Label>
            <Textarea
              id="close-notes"
              rows={3}
              placeholder={
                hasDelta
                  ? "Descreva o motivo da diferença (sobra, falta, sangria não registrada…)"
                  : "Observações livres sobre o fechamento."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              maxLength={1000}
            />
            {error ? (
              <p className="text-destructive text-xs">{error}</p>
            ) : null}
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
                <Loader2Icon className="animate-spin" /> Fechando…
              </>
            ) : (
              <>
                <LockIcon size={14} /> Fechar caixa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
