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
 * - On (default em produtos novos desde Onda 1.4): contagem real ativa.
 *   `stockQuantity` é integer ≥ 0; PDV bloqueia venda em zero (salvo
 *   `allowOversell`), storefront mostra "esgotado".
 * - Off: SEM CONTROLE de saldo. Próprio do uso pra serviço, encomenda,
 *   produto sob demanda. `stockQuantity = null`. Relatórios e KPIs de
 *   estoque IGNORAM esse produto. Decisão consciente do lojista.
 *
 * UX: copy explícita do trade-off em cada estado pra evitar o bug
 * histórico (auditoria 2026-05-24 — Onda 1.4) de produto entrar sem
 * tracking por omissão e ficar invisível nos relatórios de estoque.
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
              ? "Sistema soma entradas/saídas e mostra 'esgotado' em zero."
              : "Sem controle — use só pra serviço, encomenda ou produto sob demanda. Não aparece em relatórios de estoque."}
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
