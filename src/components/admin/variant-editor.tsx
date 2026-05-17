"use client";

import { ChevronDownIcon, ImageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";

import type { VariantAxis } from "@/actions/product/schema";
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
  /** Eixo: tamanho (pill texto) ou cor (swatch). Default "size". */
  axis: VariantAxis;
  /**
   * CSS color (hex/oklch/rgb). Forma do form (sempre string, "" = vazio).
   * Zod transform converte "" → null no submit. Banco recebe null quando
   * axis="size" (ver action update.ts).
   */
  colorHex: string;
  /**
   * Foto destacada por variante (padrão Shopify). NULL = usa primeira
   * imagem do produto. Quando cliente seleciona essa variante no PDP,
   * galeria principal scrolla pra essa imagem.
   */
  featuredImageId: string | null;
}

/** Imagem do produto exibida no selector de foto destacada. */
export interface VariantImageOption {
  id: string;
  url: string;
}

interface VariantEditorProps {
  value: VariantData[];
  onChange: (value: VariantData[]) => void;
  disabled?: boolean;
  maxVariants?: number;
  /**
   * Imagens já uploaded do produto. Quando vazio, selector de foto
   * destacada não aparece (lojista precisa subir foto antes).
   */
  productImages?: VariantImageOption[];
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
  productImages = [],
}: VariantEditorProps) {
  const [expanded, setExpanded] = useState(value.length > 0);
  const panelId = useId();

  const addVariant = () => {
    if (value.length >= maxVariants) return;
    const inheritedAxis = value[0]?.axis ?? "size";
    const newVariant: VariantData = {
      tempId: tempId(),
      name: "",
      priceInCents: null,
      stockQuantity: null,
      axis: inheritedAxis,
      colorHex: "",
      featuredImageId: null,
    };
    onChange([...value, newVariant]);
    setExpanded(true);
  };

  const updateVariant = (idx: number, patch: Partial<VariantData>) => {
    if ("axis" in patch && patch.axis) {
      const nextAxis = patch.axis;
      onChange(
        value.map((v, i) => ({
          ...v,
          ...(i === idx ? patch : {}),
          axis: nextAxis,
          colorHex: nextAxis === "color" ? v.colorHex : "",
        })),
      );
      return;
    }
    onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const removeVariant = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-bg-app rounded-xl border border-line">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-1">Variantes</span>
          <span className="text-ink-4 text-xs">(opcional)</span>
          {value.length > 0 ? (
            <span className="b3-pill b3-pill--brand">
              {value.length}
            </span>
          ) : null}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-ink-4 size-4 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={panelId} className="space-y-3 px-4 pb-4">
          {value.length === 0 ? (
            <p className="text-ink-4 text-xs leading-relaxed">
              Use variantes quando o produto tem tamanhos, cores ou outras
              opções com preço/estoque diferentes. Ex: P, M, G; Aro 14, 16,
              18; 100ml, 200ml.
            </p>
          ) : (
            <p className="text-ink-4 text-xs leading-relaxed">
              Use apenas um tipo de variante por produto: tamanho ou cor.
            </p>
          )}

          {value.map((variant, idx) => {
            const key = variant.id ?? variant.tempId ?? `idx-${idx}`;
            return (
              <VariantRow
                key={key}
                variant={variant}
                index={idx}
                disabled={disabled}
                productImages={productImages}
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
            <p className="text-ink-4 text-center text-xs">
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
  productImages: VariantImageOption[];
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
  productImages,
  onUpdate,
  onRemove,
}: VariantRowProps) {
  const nameId = useId();
  const priceId = useId();
  const stockId = useId();
  const axisId = useId();
  const colorId = useId();

  // Placeholder do nome muda conforme eixo: ajuda lojista a entender que
  // pra cor o "nome" é label visível ("Cru", "Café"), não o hex.
  const namePlaceholder =
    variant.axis === "color" ? "Cru · Café · Preto" : "P · 14 · 100ml";

  return (
    <div className="b3-card rounded-lg p-3">
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
            placeholder={namePlaceholder}
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
          <Label htmlFor={axisId} className="text-xs">
            Tipo
          </Label>
          <Select
            value={variant.axis}
            onValueChange={(v) => {
              const nextAxis = v as VariantAxis;
              // Trocar pra "size" zera colorHex pra não persistir lixo.
              onUpdate({
                axis: nextAxis,
                colorHex: nextAxis === "color" ? variant.colorHex : "",
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger id={axisId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="size">Tamanho</SelectItem>
              <SelectItem value="color">Cor</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        {variant.axis === "color" ? (
          <div className="space-y-1.5">
            <Label htmlFor={colorId} className="text-xs">
              Cor (hex/oklch)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={colorId}
                value={variant.colorHex}
                onChange={(e) => onUpdate({ colorHex: e.target.value })}
                disabled={disabled}
                placeholder="#1E3FE6"
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
              <span
                aria-hidden
                className="border-line size-6 shrink-0 rounded-full border"
                style={{
                  background: variant.colorHex || "transparent",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {productImages.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs">Foto destacada (opcional)</Label>
          <p className="text-ink-4 text-[11px] leading-relaxed">
            Quando o cliente selecionar essa variação, essa foto vai
            aparecer em destaque na galeria.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onUpdate({ featuredImageId: null })}
              disabled={disabled}
              aria-pressed={variant.featuredImageId === null}
              className={cn(
                "bg-bg-app text-ink-4 hocus:bg-line flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 text-[9.5px] font-medium tracking-wide uppercase transition-colors",
                variant.featuredImageId === null
                  ? "border-ink-1"
                  : "border-transparent",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <ImageIcon className="size-4" aria-hidden />
            </button>
            {productImages.map((img) => {
              const selected = variant.featuredImageId === img.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() =>
                    onUpdate({ featuredImageId: selected ? null : img.id })
                  }
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label="Selecionar como foto destacada"
                  className={cn(
                    "relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition-all",
                    selected
                      ? "border-ink-1"
                      : "border-transparent hover:border-ink-5",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Image
                    src={img.url}
                    alt=""
                    width={48}
                    height={48}
                    className="size-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
