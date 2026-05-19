"use client";

/**
 * ADR-0034 Camada 2 — FormCard "Gestão da loja" do ProductForm.
 *
 * Concentra os 10 campos novos da Camada Comercial:
 *   - Comercial: wholesalePriceInCents
 *   - Custo & Margem: costPriceInCents, defaultCommissionBps (+ MarginLivePreview)
 *   - Estoque: minStockQuantity, maxStockQuantity
 *   - Identidade: brand, gtin, internalCode, unit
 *   - Tributação: ncm
 *
 * Onda B.2 (próxima) refatora ProductForm em 5 abas via shadcn Tabs e
 * distribui cada campo no tab correto. Esta seção sobrevive como fonte
 * dos inputs — só a hierarquia visual muda.
 *
 * Estilo segue padrão `b3-card` do design system Vitrê (ADR-0019 Ondas 0-5i).
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

interface CommercialFieldsCardProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
}

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "un", label: "Unidade (un)" },
  { value: "pc", label: "Peça (pc)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "m", label: "Metro (m)" },
  { value: "cm", label: "Centímetro (cm)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "L", label: "Litro (L)" },
  { value: "m2", label: "Metro quadrado (m²)" },
  { value: "m3", label: "Metro cúbico (m³)" },
];

export function CommercialFieldsCard({
  control,
  register,
  errors,
  isPending,
}: CommercialFieldsCardProps) {
  // Observa custo e preço de venda pra MarginLivePreview reativo.
  const costPriceInCents = useWatch({ control, name: "costPriceInCents" });
  const basePriceInCents = useWatch({ control, name: "basePriceInCents" });

  return (
    <section className="b3-card flex flex-col gap-4 rounded-2xl p-4 sm:p-5 xl:p-6">
      <header className="space-y-0.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
          Gestão da loja
        </h2>
        <p className="text-ink-4 text-[11.5px] leading-relaxed">
          Custo, margem, estoque mínimo e identificação. Esses dados ficam
          internos — não aparecem na loja online. Sem o custo, relatórios
          de margem ficam vazios.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {/* Custo + comissão lado a lado (2 colunas em desktop). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-cost" className="text-[12.5px]">
              Preço de custo
            </Label>
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
            {errors.costPriceInCents?.message ? (
              <p className="text-destructive text-xs">
                {errors.costPriceInCents.message}
              </p>
            ) : (
              <p className="text-ink-4 text-[11px]">
                Quanto a loja paga por unidade.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-commission" className="text-[12.5px]">
              Comissão padrão do vendedor (%)
            </Label>
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
            {errors.defaultCommissionBps?.message ? (
              <p className="text-destructive text-xs">
                {errors.defaultCommissionBps.message}
              </p>
            ) : (
              <p className="text-ink-4 text-[11px]">
                Quanto o vendedor ganha por unidade vendida.
              </p>
            )}
          </div>
        </div>

        {/* Margem ao vivo — atualiza em tempo real conforme custo/venda mudam. */}
        <MarginLivePreview
          costPriceInCents={costPriceInCents}
          basePriceInCents={basePriceInCents}
          showWhenEmpty
        />

        {/* Preço de atacado (Comercial). */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-wholesale" className="text-[12.5px]">
            Preço de atacado (opcional)
          </Label>
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
          {errors.wholesalePriceInCents?.message ? (
            <p className="text-destructive text-xs">
              {errors.wholesalePriceInCents.message}
            </p>
          ) : (
            <p className="text-ink-4 text-[11px]">
              Preço quando lojista escolher "Atacado" no PDV. Precisa ser
              menor ou igual ao preço de venda.
            </p>
          )}
        </div>

        {/* Estoque mín/máx lado a lado. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-min-stock" className="text-[12.5px]">
              Estoque mínimo
            </Label>
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
            {errors.minStockQuantity?.message ? (
              <p className="text-destructive text-xs">
                {errors.minStockQuantity.message}
              </p>
            ) : (
              <p className="text-ink-4 text-[11px]">
                Alerta de reposição quando atual fica abaixo.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-max-stock" className="text-[12.5px]">
              Estoque máximo
            </Label>
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
            {errors.maxStockQuantity?.message ? (
              <p className="text-destructive text-xs">
                {errors.maxStockQuantity.message}
              </p>
            ) : (
              <p className="text-ink-4 text-[11px]">
                Opcional. Usado em projeção de compra.
              </p>
            )}
          </div>
        </div>

        {/* Identidade extra: marca + unidade. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-brand" className="text-[12.5px]">
              Marca (opcional)
            </Label>
            <Input
              id="product-brand"
              {...register("brand")}
              placeholder="Ex: Nike, Vivara, Lacoste"
              disabled={isPending}
              maxLength={80}
              aria-invalid={!!errors.brand}
            />
            {errors.brand?.message ? (
              <p className="text-destructive text-xs">
                {errors.brand.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-unit" className="text-[12.5px]">
              Unidade de venda
            </Label>
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
        </div>

        {/* GTIN + Código interno lado a lado. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-gtin" className="text-[12.5px]">
              Código de barras (GTIN)
            </Label>
            <Input
              id="product-gtin"
              {...register("gtin")}
              placeholder="EAN-13 (13 dígitos)"
              disabled={isPending}
              maxLength={14}
              aria-invalid={!!errors.gtin}
              inputMode="numeric"
            />
            {errors.gtin?.message ? (
              <p className="text-destructive text-xs">{errors.gtin.message}</p>
            ) : (
              <p className="text-ink-4 text-[11px]">
                Usado pelo leitor de código de barras no PDV.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-internal-code" className="text-[12.5px]">
              Código interno (SKU)
            </Label>
            <Input
              id="product-internal-code"
              {...register("internalCode")}
              placeholder="Ex: ANE-12-OURO"
              disabled={isPending}
              maxLength={60}
              aria-invalid={!!errors.internalCode}
            />
            {errors.internalCode?.message ? (
              <p className="text-destructive text-xs">
                {errors.internalCode.message}
              </p>
            ) : (
              <p className="text-ink-4 text-[11px]">Etiqueta interna da loja.</p>
            )}
          </div>
        </div>

        {/* NCM (tributação — texto livre, sem cálculo). */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-ncm" className="text-[12.5px]">
            NCM (opcional, 8 dígitos)
          </Label>
          <Input
            id="product-ncm"
            {...register("ncm")}
            placeholder="Ex: 71131900"
            disabled={isPending}
            maxLength={8}
            aria-invalid={!!errors.ncm}
            inputMode="numeric"
          />
          {errors.ncm?.message ? (
            <p className="text-destructive text-xs">{errors.ncm.message}</p>
          ) : (
            <p className="text-ink-4 text-[11px]">
              Código do contador pra integração futura com emissor de NF.
              Vitrê não calcula imposto.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
