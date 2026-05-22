"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface StockValue {
  trackStock: boolean;
  /** null quando trackStock=false (estoque ilimitado). */
  stockQuantity: number | null;
}

interface StockInputProps {
  value: StockValue;
  onChange: (value: StockValue) => void;
  disabled?: boolean;
}

/**
 * Toggle "Controlar estoque" + input numérico condicional.
 *
 * - Off (default): estoque ilimitado. `stockQuantity = null`.
 * - On: input revelado. `stockQuantity` é integer ≥ 0.
 *
 * UX: explica em texto pequeno o que cada estado significa pro lojista.
 */
export function StockInput({ value, onChange, disabled }: StockInputProps) {
  const switchId = useId();
  const qtyId = useId();

  return (
    <div className="space-y-3">
      <div className="bg-bg-app flex items-center justify-between gap-3 rounded-xl border border-line p-3">
        <div className="space-y-0.5">
          <Label htmlFor={switchId} className="cursor-pointer text-sm">
            Controlar estoque
          </Label>
          <p className="text-ink-4 text-xs">
            {value.trackStock
              ? "Cliente vê 'esgotado' quando chegar a 0."
              : "Estoque ilimitado — sempre disponível."}
          </p>
        </div>
        <Switch
          id={switchId}
          checked={value.trackStock}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({
              trackStock: checked,
              stockQuantity: checked ? (value.stockQuantity ?? 0) : null,
            })
          }
        />
      </div>

      {value.trackStock ? (
        <div className="space-y-1.5">
          <Label htmlFor={qtyId} className="text-xs">
            Estoque atual
          </Label>
          <Input
            id={qtyId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={value.stockQuantity ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw === "") {
                onChange({ trackStock: true, stockQuantity: null });
                return;
              }
              const n = parseInt(raw, 10);
              onChange({
                trackStock: true,
                stockQuantity: Number.isNaN(n) ? null : Math.max(0, n),
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
