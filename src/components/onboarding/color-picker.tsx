"use client";

import { CheckIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { isValidHexColor, SUGGESTED_PRIMARY_COLORS } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Paleta sugerida + opção custom hex.
 * Visual: 8 swatches numa grade + input "Outra cor (hex)".
 */
export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const isCustom = !SUGGESTED_PRIMARY_COLORS.some((c) => c.value.toLowerCase() === value.toLowerCase());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {SUGGESTED_PRIMARY_COLORS.map((c) => {
          const selected = value.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(c.value)}
              className={cn(
                "relative aspect-square rounded-xl border-2 transition-all",
                selected
                  ? "border-foreground scale-105 shadow-sm"
                  : "border-border hover:border-muted-foreground",
                disabled && "cursor-not-allowed opacity-50",
              )}
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
              title={c.name}
            >
              {selected ? (
                <CheckIcon
                  className={cn(
                    "absolute inset-0 m-auto size-4",
                    isLight(c.value) ? "text-black" : "text-white",
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-muted-foreground text-xs">
          Outra cor (hex)
        </label>
        <Input
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="#RRGGBB"
          value={isCustom ? value : ""}
          disabled={disabled}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = "#" + v;
            onChange(v);
          }}
          aria-invalid={isCustom && value.length > 0 && !isValidHexColor(value)}
          className="h-9 max-w-[140px] font-mono text-sm"
        />
      </div>
    </div>
  );
}

/**
 * Heurística simples para escolher cor de check (luminância > 0.6 = clara).
 * Não precisa ser exata — só evita check invisível.
 */
function isLight(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [, r, g, b] = m;
  const rn = parseInt(r!, 16) / 255;
  const gn = parseInt(g!, 16) / 255;
  const bn = parseInt(b!, 16) / 255;
  // luminância ITU-R BT.709
  return 0.2126 * rn + 0.7152 * gn + 0.0722 * bn > 0.6;
}
