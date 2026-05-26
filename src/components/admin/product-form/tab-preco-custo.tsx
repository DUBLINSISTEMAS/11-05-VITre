"use client";

// Aba "Preço & Custo" do ProductForm — preço de venda, custo+margem, NCM.
//
// Onda 2.1 / 2.2 (2026-05-22): componente agora renderiza em 2 modos
// pra suportar a navegação de 3 abas com progressive disclosure:
//
//  - `hideAdvanced` (na aba "Preço & Estoque"): mostra só o essencial
//    (Preço de venda + Custo + Margem). Promo, atacado, comissão e NCM
//    vão pra aba "Avançado".
//  - `onlyAdvanced` (na aba "Avançado"): mostra exatamente o que o modo
//    acima esconde.
//  - default (legacy): mostra tudo num só lugar — preservado pra callers
//    que ainda não migraram pra split.
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";
import { MarginLivePreview } from "@/components/admin/margin-live-preview";
import { MarginQuickSimulator } from "@/components/admin/margin-quick-simulator";
import { PriceInput } from "@/components/admin/price-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SubCard } from "./shared";

interface TabPrecoCustoProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
  /** Passo 10 — escrita no preço a partir do simulador rápido de markup/margem. */
  setValue: UseFormSetValue<ProductFormValues>;
  /** Onda 2.2 — esconde promo/atacado/comissão/NCM (vão pra aba Avançado). */
  hideAdvanced?: boolean;
  /** Onda 2.2 — renderiza APENAS o que `hideAdvanced` esconde. */
  onlyAdvanced?: boolean;
}

export function TabPrecoCusto({
  control,
  register,
  errors,
  isPending,
  setValue,
  hideAdvanced = false,
  onlyAdvanced = false,
}: TabPrecoCustoProps) {
  const costPriceInCents = useWatch({ control, name: "costPriceInCents" });
  const basePriceInCents = useWatch({ control, name: "basePriceInCents" });

  const showEssential = !onlyAdvanced;
  const showAdvanced = !hideAdvanced;

  return (
    <div className="flex flex-col gap-4">
      {/* === ESSENCIAL: Preço de venda + Custo + Margem === */}
      {showEssential ? (
        <SubCard
          title="Preço & Custo"
          description="Quanto pago e quanto vendo. A margem aparece automaticamente."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-base-price" required>
                Preço de venda
              </Label>
              <Controller
                name="basePriceInCents"
                control={control}
                render={({ field }) => (
                  <PriceInput
                    id="product-base-price"
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                    disabled={isPending}
                    aria-invalid={!!errors.basePriceInCents}
                  />
                )}
              />
              {errors.basePriceInCents?.message ? (
                <p className="text-destructive text-xs">
                  {errors.basePriceInCents.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-cost">Custo do produto</Label>
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
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Margem</Label>
              <MarginLivePreview
                costPriceInCents={costPriceInCents}
                basePriceInCents={basePriceInCents}
                showWhenEmpty
              />
            </div>
          </div>

          {/* Simulador rápido — handoff Passo 10. Calcula preço de venda
              a partir do custo + markup/margem-alvo. Só ativo quando o
              custo está preenchido. */}
          <div className="mt-4 border-t border-line/60 pt-4">
            <MarginQuickSimulator
              costPriceInCents={costPriceInCents}
              setValue={setValue}
            />
          </div>
        </SubCard>
      ) : null}

      {/* === AVANÇADO: promoção, atacado, comissão, NCM === */}
      {showAdvanced ? (
        <>
          <SubCard
            title="Promoção e atacado"
            description="Use quando quiser oferecer preço diferente do normal."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-promo-price">Preço promocional</Label>
                <Controller
                  name="promoPriceInCents"
                  control={control}
                  render={({ field }) => (
                    <PriceInput
                      id="product-promo-price"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Sem promoção"
                      disabled={isPending}
                      aria-invalid={!!errors.promoPriceInCents}
                    />
                  )}
                />
                {errors.promoPriceInCents?.message ? (
                  <p className="text-destructive text-xs">
                    {errors.promoPriceInCents.message}
                  </p>
                ) : null}
                <p className="text-ink-4 text-[11px]">
                  Promoção ativa enquanto preenchida.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-wholesale">Preço de atacado</Label>
                <Controller
                  control={control}
                  name="wholesalePriceInCents"
                  render={({ field }) => (
                    <PriceInput
                      id="product-wholesale"
                      value={field.value ?? null}
                      onChange={(cents) => field.onChange(cents)}
                      disabled={isPending}
                      placeholder="Sem atacado"
                      aria-invalid={!!errors.wholesalePriceInCents}
                    />
                  )}
                />
                {errors.wholesalePriceInCents?.message ? (
                  <p className="text-destructive text-xs">
                    {errors.wholesalePriceInCents.message}
                  </p>
                ) : null}
                <p className="text-ink-4 text-[11px]">
                  Use se vende em pacote ou pra revendedor.
                </p>
              </div>
            </div>
          </SubCard>

          <SubCard
            title="Comissão de vendedor"
            description="Se você paga comissão pro vendedor neste produto, preencha o %."
          >
            <div className="space-y-1.5 max-w-[260px]">
              <Label htmlFor="product-commission">Comissão padrão (%)</Label>
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
              ) : null}
              <p className="text-ink-4 text-[11px]">
                Deixe em branco se você é a única vendedora.
              </p>
            </div>
          </SubCard>

          <SubCard
            title="Código fiscal (NCM)"
            description="Só preencha se sua contabilidade ou Bling/Tiny pediu. Não influencia em nada na venda."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-ncm">NCM</Label>
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
                ) : null}
              </div>
              {/* S2.7 (2026-05-26) — peso em gramas pra reprecificação por
                  metal em joalheria. Nullable. */}
              <div className="space-y-1.5">
                <Label htmlFor="product-weight-grams">Peso (g)</Label>
                <Input
                  id="product-weight-grams"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100000"
                  {...register("weightGrams", { valueAsNumber: true })}
                  placeholder="Ex: 4.200"
                  disabled={isPending}
                  aria-invalid={!!errors.weightGrams}
                  inputMode="decimal"
                />
                {errors.weightGrams?.message ? (
                  <p className="text-destructive text-xs">
                    {errors.weightGrams.message}
                  </p>
                ) : (
                  <p className="text-ink-4 text-[11px]">
                    Joalheria: peso em gramas pra recálculo quando metal subir.
                  </p>
                )}
              </div>
            </div>
          </SubCard>
        </>
      ) : null}
    </div>
  );
}
