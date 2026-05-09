"use client";

import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tempId } from "@/lib/id";
import { cn } from "@/lib/utils";

import { PriceInput } from "./price-input";

export interface VariantData {
  /** server-side id (presente quando já persistida) */
  id?: string;
  /** client-side id estável (presente até salvar) */
  tempId?: string;
  name: string;
  /** centavos. null = usa basePriceInCents do produto */
  priceInCents: number | null;
  /** null = usa stock do produto (ou ilimitado) */
  stockQuantity: number | null;
}

interface VariantEditorProps {
  value: VariantData[];
  onChange: (value: VariantData[]) => void;
  disabled?: boolean;
  maxVariants?: number;
}

const DEFAULT_MAX = 20;

/**
 * Editor de variantes (acordeão recolhido por default).
 *
 * MVP: cada variante tem só nome + preço opcional + estoque opcional.
 * Atributos JSONB (cor, tamanho, banho como pares chave-valor) ficam
 * pra Fase 2 — `name` cobre o caso "P", "M", "G" ou "Anel 14" sem complicar.
 */
export function VariantEditor({
  value,
  onChange,
  disabled,
  maxVariants = DEFAULT_MAX,
}: VariantEditorProps) {
  const [expanded, setExpanded] = useState(value.length > 0);
  const panelId = useId();

  const addVariant = () => {
    if (value.length >= maxVariants) return;
    const newVariant: VariantData = {
      tempId: tempId(),
      name: "",
      priceInCents: null,
      stockQuantity: null,
    };
    onChange([...value, newVariant]);
    setExpanded(true);
  };

  const updateVariant = (idx: number, patch: Partial<VariantData>) => {
    onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const removeVariant = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-muted/30 rounded-xl border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Variantes</span>
          <span className="text-muted-foreground text-xs">(opcional)</span>
          {value.length > 0 ? (
            <span className="bg-vitre-100 text-vitre-700 rounded-full px-2 py-0.5 text-xs font-medium">
              {value.length}
            </span>
          ) : null}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground size-4 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={panelId} className="space-y-3 px-4 pb-4">
          {value.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Use variantes quando o produto tem tamanhos, cores ou outras
              opções com preço/estoque diferentes. Ex: P, M, G; Aro 14, 16,
              18; 100ml, 200ml.
            </p>
          ) : null}

          {value.map((variant, idx) => {
            const key = variant.id ?? variant.tempId ?? `idx-${idx}`;
            return (
              <VariantRow
                key={key}
                variant={variant}
                index={idx}
                disabled={disabled}
                onUpdate={(patch) => updateVariant(idx, patch)}
                onRemove={() => removeVariant(idx)}
              />
            );
          })}

          {value.length < maxVariants ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariant}
              disabled={disabled}
              className="w-full"
            >
              <PlusIcon /> Adicionar variante
            </Button>
          ) : (
            <p className="text-muted-foreground text-center text-xs">
              Limite de {maxVariants} variantes atingido.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface VariantRowProps {
  variant: VariantData;
  index: number;
  disabled?: boolean;
  onUpdate: (patch: Partial<VariantData>) => void;
  onRemove: () => void;
}

/**
 * Linha de variante. Componente próprio pra ter `useId` estável por linha
 * (associando Label↔Input corretamente sem colidir entre variantes).
 */
function VariantRow({
  variant,
  index,
  disabled,
  onUpdate,
  onRemove,
}: VariantRowProps) {
  const nameId = useId();
  const priceId = useId();
  const stockId = useId();

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={nameId} className="text-xs">
            Nome
          </Label>
          <Input
            id={nameId}
            value={variant.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={disabled}
            placeholder="P · 14 · 100ml"
            maxLength={40}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="mt-6"
          aria-label={`Remover variante ${variant.name || index + 1}`}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={priceId} className="text-xs">
            Preço
          </Label>
          <PriceInput
            id={priceId}
            value={variant.priceInCents}
            onChange={(v) => onUpdate({ priceInCents: v })}
            disabled={disabled}
            placeholder="Igual ao base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={stockId} className="text-xs">
            Estoque
          </Label>
          <Input
            id={stockId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={variant.stockQuantity ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw === "") {
                onUpdate({ stockQuantity: null });
                return;
              }
              const n = parseInt(raw, 10);
              onUpdate({
                stockQuantity: Number.isNaN(n) ? null : Math.max(0, n),
              });
            }}
            disabled={disabled}
            placeholder="Ilimitado"
          />
        </div>
      </div>
    </div>
  );
}
