"use client";

/**
 * ADR-0034 Camada 2 — sub-cards do ProductForm.
 *
 * Onda B.2 (página densa horizontal): 4 cards exportáveis pequenos que
 * ficam lado a lado em grid 3 colunas dentro do ProductForm. Densidade
 * estilo informacional GFIL — informações pequenas, sem scroll quando
 * possível.
 *
 *   <CommercialCard />    — preço de atacado
 *   <CostMarginCard />    — custo + comissão + MarginLivePreview
 *   <InventoryExtraCard />— mín/máx (track + qty já vivem na seção Estoque)
 *   <IdentityExtraCard /> — marca, unidade, GTIN, código interno
 *   <NcmField />          — NCM (compacto, usado em "Detalhes/Tributação")
 *
 * `<CommercialFieldsCard />` continua exportado como compat (usado em
 * test/storybook se houver) mas o ProductForm refator usa os 4 sub-cards
 * direto.
 */

import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import type { ProductFormValues, ProductUnit } from "@/actions/product/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MarginLivePreview } from "./margin-live-preview";
import { PriceInput } from "./price-input";

interface SubCardProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
}

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "un", label: "un" },
  { value: "pc", label: "pç" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "m", label: "m" },
  { value: "cm", label: "cm" },
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
  { value: "m2", label: "m²" },
  { value: "m3", label: "m³" },
];

// =====================================================================
// Helpers visuais — wrappers de FormCard denso reaproveitados
// =====================================================================

function DenseCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="b3-card flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
      <header className="space-y-0.5">
        <h3 className="text-[12.5px] font-semibold tracking-tight text-ink-1">
          {title}
        </h3>
        {description ? (
          <p className="text-ink-4 text-[11px] leading-snug">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function DenseLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-[11.5px] font-medium text-ink-2">
      {children}
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-[10.5px] leading-tight">{message}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-4 text-[10.5px] leading-tight">{children}</p>;
}

// =====================================================================
// CommercialCard — preço de atacado
// (Preço base + promo continuam no card "Preço" existente do ProductForm;
//  atacado vive aqui pra ficar próximo do custo no layout 3 colunas)
// =====================================================================
export function CommercialCard({ control, errors, isPending }: SubCardProps) {
  return (
    <DenseCard title="Atacado">
      <div className="flex flex-col gap-1.5">
        <DenseLabel htmlFor="product-wholesale">Preço de atacado</DenseLabel>
        <Controller
          control={control}
          name="wholesalePriceInCents"
          render={({ field }) => (
            <PriceInput
              id="product-wholesale"
              value={field.value ?? null}
              onChange={(cents) => field.onChange(cents)}
              disabled={isPending}
              placeholder="R$ 0,00"
              aria-invalid={!!errors.wholesalePriceInCents}
            />
          )}
        />
        <FieldError message={errors.wholesalePriceInCents?.message} />
        <FieldHint>
          Aplicado quando &ldquo;Atacado&rdquo; for selecionado no PDV.
          Precisa ser menor ou igual ao preço normal.
        </FieldHint>
      </div>
    </DenseCard>
  );
}

// =====================================================================
// CostMarginCard — custo + comissão + margem ao vivo
// =====================================================================
export function CostMarginCard({ control, errors, isPending }: SubCardProps) {
  const costPriceInCents = useWatch({ control, name: "costPriceInCents" });
  const basePriceInCents = useWatch({ control, name: "basePriceInCents" });

  return (
    <DenseCard
      title="Custo & Margem"
      description="Interno. Não aparece na loja online."
    >
      <div className="flex flex-col gap-1.5">
        <DenseLabel htmlFor="product-cost">Preço de custo</DenseLabel>
        <Controller
          control={control}
          name="costPriceInCents"
          render={({ field }) => (
            <PriceInput
              id="product-cost"
              value={field.value ?? null}
              onChange={(cents) => field.onChange(cents)}
              disabled={isPending}
              placeholder="R$ 0,00"
              aria-invalid={!!errors.costPriceInCents}
            />
          )}
        />
        <FieldError message={errors.costPriceInCents?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <DenseLabel htmlFor="product-commission">
          Comissão do vendedor (%)
        </DenseLabel>
        <Controller
          control={control}
          name="defaultCommissionBps"
          render={({ field }) => (
            <Input
              id="product-commission"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="100"
              placeholder="0"
              disabled={isPending}
              value={
                field.value === null || field.value === undefined
                  ? ""
                  : (field.value / 100).toString()
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  field.onChange(null);
                  return;
                }
                const num = Number(raw.replace(",", "."));
                if (!Number.isFinite(num)) return;
                field.onChange(Math.round(num * 100));
              }}
              aria-invalid={!!errors.defaultCommissionBps}
            />
          )}
        />
        <FieldError message={errors.defaultCommissionBps?.message} />
      </div>

      <MarginLivePreview
        costPriceInCents={costPriceInCents}
        basePriceInCents={basePriceInCents}
        showWhenEmpty
      />
    </DenseCard>
  );
}

// =====================================================================
// InventoryExtraCard — mín/máx (track e qty atual ficam em outro card)
// =====================================================================
export function InventoryExtraCard({ control, errors, isPending }: SubCardProps) {
  return (
    <DenseCard
      title="Estoque mín/máx"
      description="Alerta de reposição quando atual < mínimo."
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-min-stock">Mínimo</DenseLabel>
          <Controller
            control={control}
            name="minStockQuantity"
            render={({ field }) => (
              <Input
                id="product-min-stock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                disabled={isPending}
                value={
                  field.value === null || field.value === undefined
                    ? ""
                    : field.value.toString()
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    field.onChange(null);
                    return;
                  }
                  const num = Number.parseInt(raw, 10);
                  if (!Number.isFinite(num) || num < 0) return;
                  field.onChange(num);
                }}
                aria-invalid={!!errors.minStockQuantity}
              />
            )}
          />
          <FieldError message={errors.minStockQuantity?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-max-stock">Máximo</DenseLabel>
          <Controller
            control={control}
            name="maxStockQuantity"
            render={({ field }) => (
              <Input
                id="product-max-stock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                disabled={isPending}
                value={
                  field.value === null || field.value === undefined
                    ? ""
                    : field.value.toString()
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    field.onChange(null);
                    return;
                  }
                  const num = Number.parseInt(raw, 10);
                  if (!Number.isFinite(num) || num < 0) return;
                  field.onChange(num);
                }}
                aria-invalid={!!errors.maxStockQuantity}
              />
            )}
          />
          <FieldError message={errors.maxStockQuantity?.message} />
        </div>
      </div>
    </DenseCard>
  );
}

// =====================================================================
// IdentityExtraCard — marca, unidade, GTIN, código interno
// Aparece como banda densa em layout horizontal (4 colunas em desktop).
// =====================================================================
export function IdentityExtraCard({
  control,
  register,
  errors,
  isPending,
}: SubCardProps) {
  return (
    <DenseCard
      title="Identificação adicional"
      description="Usados em busca, etiqueta, scanner do PDV e integração futura."
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-brand">Marca</DenseLabel>
          <Input
            id="product-brand"
            {...register("brand")}
            placeholder="Ex: Vivara, Nike"
            disabled={isPending}
            maxLength={80}
            aria-invalid={!!errors.brand}
          />
          <FieldError message={errors.brand?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-unit">Unidade</DenseLabel>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                disabled={isPending}
              >
                <SelectTrigger id="product-unit" aria-invalid={!!errors.unit}>
                  <SelectValue placeholder="un" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-gtin">Cód. barras (GTIN)</DenseLabel>
          <Input
            id="product-gtin"
            {...register("gtin")}
            placeholder="EAN-13"
            disabled={isPending}
            maxLength={14}
            aria-invalid={!!errors.gtin}
            inputMode="numeric"
          />
          <FieldError message={errors.gtin?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <DenseLabel htmlFor="product-internal-code">Código interno</DenseLabel>
          <Input
            id="product-internal-code"
            {...register("internalCode")}
            placeholder="Ex: ANE-12"
            disabled={isPending}
            maxLength={60}
            aria-invalid={!!errors.internalCode}
          />
          <FieldError message={errors.internalCode?.message} />
        </div>
      </div>
    </DenseCard>
  );
}

// =====================================================================
// NcmField — campo único (NCM). Compacto, vive dentro do card "Detalhes"
// (ou onde fizer sentido). Vitrê NÃO calcula imposto — campo é livre pra
// integração futura com Bling/Tiny (ADR-0033).
// =====================================================================
export function NcmField({
  register,
  errors,
  isPending,
}: Pick<SubCardProps, "register" | "errors" | "isPending">) {
  return (
    <div className="flex flex-col gap-1.5">
      <DenseLabel htmlFor="product-ncm">NCM (8 dígitos)</DenseLabel>
      <Input
        id="product-ncm"
        {...register("ncm")}
        placeholder="Ex: 71131900"
        disabled={isPending}
        maxLength={8}
        aria-invalid={!!errors.ncm}
        inputMode="numeric"
      />
      <FieldError message={errors.ncm?.message} />
      <FieldHint>
        Pra integração futura com emissor de NF. Vitrê não calcula imposto.
      </FieldHint>
    </div>
  );
}

// =====================================================================
// CommercialFieldsCard — COMPAT. Versão monolítica usada na Onda B.1.
// Onda B.2 não usa mais; mantido caso testes ou import esquecido referenciem.
// =====================================================================
export function CommercialFieldsCard(props: SubCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <IdentityExtraCard {...props} />
      <div className="grid gap-3 lg:grid-cols-3">
        <CommercialCard {...props} />
        <CostMarginCard {...props} />
        <InventoryExtraCard {...props} />
      </div>
      <DenseCard title="Tributação">
        <NcmField {...props} />
      </DenseCard>
    </div>
  );
}
