"use client";

/**
 * Drawer "Ajustar estoque" — migrado de Dialog → Sheet em PP3 (handoff
 * 2026-05-25). Mantém nome `StockMovementDialog` pra não quebrar callers,
 * mas internamente é Sheet slide-right 460px conforme protótipo
 * `drawers.jsx` linhas 515-593.
 *
 * Cobre os 3 tipos manuais: manual_in (entrada), manual_out (saída),
 * adjustment (ajuste com direção). Tipos automáticos (sale/return/initial)
 * NÃO entram aqui — são gerados pelo sistema.
 *
 * Novo em PP3: preview "Novo saldo" cream-soft com cálculo live quando
 * `currentStockQuantity` é fornecido. Callers que não passam o saldo
 * continuam funcionando — o preview só esconde.
 */
import { ArrowLeftRightIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordStockMovement } from "@/actions/stock/record-movement";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  /**
   * PP3 — saldo atual pra mostrar preview "Novo saldo" cream-soft no
   * footer. Quando ausente, preview esconde (callers antigos seguem ok).
   */
  currentStockQuantity?: number;
  /** Unidade pra exibir junto ao saldo (ex: "un", "kg"). Default "un". */
  unit?: string;
}

const TYPE_LABEL: Record<MovementType, string> = {
  manual_in: "Entrada",
  manual_out: "Saída",
  adjustment: "Acerto",
};

const TYPE_HINT: Record<MovementType, string> = {
  manual_in: "Compra de fornecedor, devolução de cliente, brinde recebido.",
  manual_out: "Perda, dano, doação, uso interno.",
  adjustment: "Contagem física diferente do sistema — ajusta o saldo.",
};

// Onda 2.5 — atalhos de motivo pra saída.
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
  currentStockQuantity,
  unit = "un",
}: StockMovementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [movementType, setMovementType] = useState<MovementType>("manual_in");
  const [variantId, setVariantId] = useState<string>("__none__");
  const [direction, setDirection] = useState<"positive" | "negative">("positive");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  // Audit 2026-05-26 — modo do ajuste:
  //   "delta": lojista digita "quanto ajustar" (atual + sinal). Padrão.
  //   "final": lojista digita "saldo contado" — sistema calcula delta sozinho.
  // Só disponível em movementType=adjustment + sem variante selecionada
  // (currentStockQuantity é do produto, variante teria saldo próprio).
  const [adjustmentMode, setAdjustmentMode] = useState<"delta" | "final">(
    "delta",
  );

  const reset = () => {
    setMovementType("manual_in");
    setVariantId("__none__");
    setDirection("positive");
    setQuantity("");
    setNotes("");
    setAdjustmentMode("delta");
  };

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawNum = Number(quantity);
    if (!Number.isInteger(rawNum) || rawNum < 0) {
      toast.error("Valor inválido.");
      return;
    }

    // Audit 2026-05-26 — modo "saldo final": calcula delta = contado − atual.
    // Quando contado === atual, NADA muda — bloquear pra evitar lançamento vazio.
    let finalQty: number;
    let finalDirection: "positive" | "negative" = direction;

    if (
      movementType === "adjustment" &&
      adjustmentMode === "final" &&
      typeof currentStockQuantity === "number"
    ) {
      const delta = rawNum - currentStockQuantity;
      if (delta === 0) {
        toast.error(
          "Saldo contado igual ao atual — nada a ajustar.",
        );
        return;
      }
      finalQty = Math.abs(delta);
      finalDirection = delta > 0 ? "positive" : "negative";
    } else {
      if (rawNum < 1) {
        toast.error("Quantidade inválida.");
        return;
      }
      finalQty = rawNum;
    }

    startTransition(async () => {
      const result = await recordStockMovement({
        productId,
        variantId: variantId === "__none__" ? null : variantId,
        movementType,
        quantity: finalQty,
        adjustmentDirection:
          movementType === "adjustment" ? finalDirection : undefined,
        notes: notes.trim() || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const sign =
        movementType === "manual_in" ||
        (movementType === "adjustment" && finalDirection === "positive")
          ? "+"
          : "-";
      toast.success(`Movimentação registrada (${sign}${finalQty}).`);
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  // Audit 2026-05-26 — preview de novo saldo agora cobre 2 modos:
  //   delta (default): qty é o quanto ajustar. previewNewStock = atual + sinal × qty.
  //   final: qty é o saldo contado. previewNewStock = qty diretamente.
  // Em manual_in / manual_out o modo final não se aplica.
  const qtyNum = Number(quantity);
  const isAdjustmentFinalMode =
    movementType === "adjustment" && adjustmentMode === "final";
  const hasValidQty = isAdjustmentFinalMode
    ? Number.isInteger(qtyNum) && qtyNum >= 0
    : Number.isInteger(qtyNum) && qtyNum >= 1;
  const showPreview =
    typeof currentStockQuantity === "number" && hasValidQty;
  let previewNewStock: number | null = null;
  if (showPreview) {
    if (isAdjustmentFinalMode) {
      // Modo "saldo final" — o que o lojista digita já É o novo saldo.
      previewNewStock = qtyNum;
    } else {
      const delta =
        movementType === "manual_in" ||
        (movementType === "adjustment" && direction === "positive")
          ? qtyNum
          : -qtyNum;
      previewNewStock = Math.max(0, currentStockQuantity! + delta);
    }
  }
  // Toggle só faz sentido em adjustment SEM variante selecionada
  // (currentStockQuantity é do produto, variante teria saldo próprio).
  const canShowAdjustmentModeToggle =
    movementType === "adjustment" &&
    typeof currentStockQuantity === "number" &&
    variantId === "__none__";

  const isOutflow =
    movementType === "manual_out" ||
    (movementType === "adjustment" && direction === "negative");

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger ?? <Button variant="outline">Lançar movimentação</Button>}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]"
      >
        {/* Header — avatar cream-soft + título + fechar (Sheet built-in). */}
        <SheetHeader className="border-line shrink-0 gap-0 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-[10px]"
              style={{
                background: "var(--mangos-cream-soft)",
                color: "var(--mangos-green-800)",
              }}
            >
              <ArrowLeftRightIcon className="size-4.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-ink-1 text-[15px] font-semibold tracking-tight">
                Ajustar estoque
              </SheetTitle>
              <SheetDescription className="text-ink-4 truncate text-[12px]">
                {productName}
                {typeof currentStockQuantity === "number" ? (
                  <span className="font-mono ml-1.5">
                    · saldo atual {currentStockQuantity} {unit}
                  </span>
                ) : null}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Body — scroll vertical interno. */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {/* Tipo: 3 cards coloridos */}
            <div className="space-y-2">
              <Label>Tipo de movimento</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["manual_in", "manual_out", "adjustment"] as const).map((t) => {
                  const isActive = movementType === t;
                  const accent =
                    t === "manual_in"
                      ? "ok"
                      : t === "manual_out"
                        ? "danger"
                        : "warn";
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMovementType(t)}
                      className={cn(
                        "rounded-md border px-3 py-2.5 text-sm font-medium transition",
                        isActive
                          ? accent === "ok"
                            ? "border-ok text-ok bg-ok-wash"
                            : accent === "danger"
                              ? "border-danger text-danger bg-danger-wash"
                              : "border-warn text-warn bg-warn-wash"
                          : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                      )}
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              <p className="text-ink-4 text-xs">{TYPE_HINT[movementType]}</p>
            </div>

            {/* Audit 2026-05-26 — toggle DELTA vs SALDO FINAL no ajuste.
                Resolve a confusão "digitei 8 mas atual era 12, deu -4 errado".
                Só aparece quando há saldo atual conhecido (sem variante). */}
            {canShowAdjustmentModeToggle ? (
              <div className="space-y-2">
                <Label>Como você quer ajustar</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode("delta")}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-[13px] font-medium leading-tight",
                      adjustmentMode === "delta"
                        ? "border-brand bg-brand-wash text-brand"
                        : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                    )}
                  >
                    Lançar diferença
                    <span className="text-ink-4 mt-0.5 block text-[10.5px] font-normal">
                      Ex: +2 ou −3 sobre o atual
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode("final")}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-[13px] font-medium leading-tight",
                      adjustmentMode === "final"
                        ? "border-brand bg-brand-wash text-brand"
                        : "border-line bg-surface text-ink-1 hocus:bg-bg-app",
                    )}
                  >
                    Tenho o saldo contado
                    <span className="text-ink-4 mt-0.5 block text-[10.5px] font-normal">
                      Digito o número que contei
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Direção (só pra adjustment em modo delta).
                No modo "final" a direção é calculada do delta automaticamente. */}
            {movementType === "adjustment" && adjustmentMode === "delta" ? (
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

            {/* Variante (opcional) */}
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

            {/* Quantidade — label e placeholder mudam quando modo "saldo final". */}
            <div className="space-y-2">
              <Label htmlFor="stock-movement-qty">
                {isAdjustmentFinalMode
                  ? `Saldo contado (atual: ${currentStockQuantity} ${unit})`
                  : "Quantidade"}
              </Label>
              <Input
                id="stock-movement-qty"
                type="number"
                inputMode="numeric"
                min={isAdjustmentFinalMode ? 0 : 1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isAdjustmentFinalMode ? "Ex: 8" : "Ex: 10"}
                autoFocus
                required
              />
              <p className="text-ink-4 text-xs">
                {isAdjustmentFinalMode
                  ? "Digite o número que você contou. O sistema calcula a diferença sozinho."
                  : "Sempre positivo. O sinal sai do tipo escolhido acima."}
              </p>
            </div>

            {/* Notas — obrigatório quando saída (Onda 2.5). */}
            <div className="space-y-2">
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
            </div>

            {/* Preview "Novo saldo" — só quando temos currentStock + qty válida.
                Cream-soft + brand-line conforme protótipo. */}
            {showPreview && previewNewStock !== null ? (
              <div
                className="rounded-[10px] p-4"
                style={{
                  background: "var(--mangos-cream-soft)",
                  border: "1px solid var(--brand-line)",
                }}
              >
                <p className="text-eyebrow">Novo saldo</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className="font-mono text-[22px] font-bold tabular-nums"
                    style={{ color: "var(--mangos-green-900)" }}
                  >
                    {currentStockQuantity} → {previewNewStock}
                  </span>
                  <span
                    className="font-mono text-[13px] font-semibold tabular-nums"
                    style={{
                      color:
                        previewNewStock - currentStockQuantity! > 0
                          ? "var(--ok)"
                          : previewNewStock - currentStockQuantity! < 0
                            ? "var(--danger)"
                            : "var(--ink-4)",
                    }}
                  >
                    ({previewNewStock - currentStockQuantity! > 0 ? "+" : ""}
                    {previewNewStock - currentStockQuantity!})
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer — Cancelar / Registrar movimento. */}
          <div className="border-line bg-surface shrink-0 flex items-center justify-end gap-2 border-t p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <SaveIcon className="size-3.5" aria-hidden />
                  Registrar movimento
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
