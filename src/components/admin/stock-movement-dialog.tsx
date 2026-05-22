"use client";

/**
 * Dialog "Lançar movimentação" no editor de produto (follow-up Fase 4 — ADR-0015).
 *
 * Cobre os 3 tipos manuais: manual_in (entrada), manual_out (saída),
 * adjustment (ajuste com direção). Tipos automáticos (sale/return/initial)
 * NÃO entram aqui — são gerados pelo sistema.
 *
 * Convenções respeitadas:
 *   - shadcn Dialog (modal pequeno, 4-5 campos — heurística do
 *     `admin-form-grande-page-not-modal` permite modal)
 *   - useTransition + router.refresh() startTransition pra não bloquear close
 *     (memory `router-refresh-in-starttransition`)
 *   - Trigger via prop pra encaixar no DropdownMenu existente
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordStockMovement } from "@/actions/stock/record-movement";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MovementType = "manual_in" | "manual_out" | "adjustment";

interface VariantOption {
  id: string;
  name: string;
  stockQuantity: number;
}

interface StockMovementDialogProps {
  productId: string;
  productName: string;
  variants: VariantOption[];
  /** Trigger custom (ex: DropdownMenuItem). Default: botão primário. */
  trigger?: React.ReactNode;
}

const TYPE_LABEL: Record<MovementType, string> = {
  manual_in: "Entrada",
  manual_out: "Saída",
  adjustment: "Ajuste",
};

const TYPE_HINT: Record<MovementType, string> = {
  manual_in: "Compra de fornecedor, devolução de cliente, brinde recebido.",
  manual_out: "Perda, dano, doação, uso interno.",
  adjustment: "Contagem física diferente do sistema — ajusta o saldo.",
};

// Onda 2.5 — atalhos de motivo pra saída. Lojista clica e o texto entra
// no campo de motivo (editável). Reduz fricção sem perder rastreabilidade.
const OUTFLOW_REASON_PRESETS = [
  "Perda",
  "Doação",
  "Brinde",
  "Troca",
  "Uso interno",
] as const;

export function StockMovementDialog({
  productId,
  productName,
  variants,
  trigger,
}: StockMovementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state — local, sem RHF (4 campos, dialog descartável)
  const [movementType, setMovementType] = useState<MovementType>("manual_in");
  const [variantId, setVariantId] = useState<string>("__none__");
  const [direction, setDirection] = useState<"positive" | "negative">(
    "positive",
  );
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const reset = () => {
    setMovementType("manual_in");
    setVariantId("__none__");
    setDirection("positive");
    setQuantity("");
    setNotes("");
  };

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Quantidade inválida.");
      return;
    }

    startTransition(async () => {
      const result = await recordStockMovement({
        productId,
        variantId: variantId === "__none__" ? null : variantId,
        movementType,
        quantity: qty,
        adjustmentDirection:
          movementType === "adjustment" ? direction : undefined,
        notes: notes.trim() || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const sign =
        movementType === "manual_in" ||
        (movementType === "adjustment" && direction === "positive")
          ? "+"
          : "-";
      toast.success(`Movimentação registrada (${sign}${qty}).`);
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Lançar movimentação</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar movimentação de estoque</DialogTitle>
          <DialogDescription>
            <span className="text-ink-1 font-medium">{productName}</span>
            {" — "}registra entrada, saída ou ajuste manual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo: 3 chips */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["manual_in", "manual_out", "adjustment"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMovementType(t)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition",
                    movementType === t
                      ? "border-brand bg-brand-wash text-brand"
                      : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                  )}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="text-ink-4 text-xs">
              {TYPE_HINT[movementType]}
            </p>
          </div>

          {/* Direção (só pra adjustment) */}
          {movementType === "adjustment" ? (
            <div className="space-y-2">
              <Label>Direção do ajuste</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("positive")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium",
                    direction === "positive"
                      ? "border-ok bg-ok-wash text-ok"
                      : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                  )}
                >
                  +Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("negative")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium",
                    direction === "negative"
                      ? "border-danger bg-danger-wash text-danger"
                      : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                  )}
                >
                  −Saída
                </button>
              </div>
            </div>
          ) : null}

          {/* Variante (opcional, só se produto tem) */}
          {variants.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="stock-movement-variant">Variante (opcional)</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger id="stock-movement-variant">
                  <SelectValue placeholder="Produto sem variante específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    Sem variante (produto base)
                  </SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {" — "}
                      <span className="text-ink-4 tabular-nums">
                        {v.stockQuantity} em estoque
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="stock-movement-qty">Quantidade</Label>
            <Input
              id="stock-movement-qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 10"
              autoFocus
              required
            />
            <p className="text-ink-4 text-xs">
              Sempre positivo. O sinal sai do tipo escolhido acima.
            </p>
          </div>

          {/* Notas — obrigatório quando saída (Onda 2.5). */}
          <div className="space-y-2">
            {(() => {
              const isOutflow =
                movementType === "manual_out" ||
                (movementType === "adjustment" && direction === "negative");
              return (
                <>
                  <Label htmlFor="stock-movement-notes">
                    {isOutflow ? (
                      <>
                        Motivo <span className="text-danger">*</span>
                      </>
                    ) : (
                      "Observação (opcional)"
                    )}
                  </Label>
                  {isOutflow ? (
                    <div className="flex flex-wrap gap-1.5">
                      {OUTFLOW_REASON_PRESETS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNotes(r)}
                          className="b3-pill text-[11px] hover:bg-bg-app cursor-pointer"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Textarea
                    id="stock-movement-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      isOutflow
                        ? "Ex: 2 peças com defeito, devolvidas pra reposição."
                        : "Ex: NF-12345 fornecedor X, ou inventário 2026-05-16."
                    }
                    rows={2}
                    maxLength={500}
                    required={isOutflow}
                  />
                  {isOutflow ? (
                    <p className="text-ink-4 text-xs">
                      Toda saída precisa de motivo — histórico fica auditável.
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
