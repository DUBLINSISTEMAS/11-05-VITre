"use client";

// Aba "Preço & Custo" do ProductForm — preço de venda, custo+margem, NCM.
// Sub-cards: Venda (3 cols), Custo (3 cols), Tributação (NCM compacto).
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";
import { MarginLivePreview } from "@/components/admin/margin-live-preview";
import { PriceInput } from "@/components/admin/price-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SubCard } from "./shared";

interface TabPrecoCustoProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
}

export function TabPrecoCusto({
  control,
  register,
  errors,
  isPending,
}: TabPrecoCustoProps) {
  const costPriceInCents = useWatch({ control, name: "costPriceInCents" });
  const basePriceInCents = useWatch({ control, name: "basePriceInCents" });

  return (
    <div className="flex flex-col gap-4">
      <SubCard
        title="Venda"
        description="Preço normal e ofertas. Atacado aplica quando lojista escolhe 'Atacado' no PDV."
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
          </div>
        </div>
        <p className="text-ink-4 text-[11px]">
          Promoção ativa enquanto preenchida. Atacado precisa ser ≤ venda.
        </p>
      </SubCard>

      <SubCard
        title="Custo"
        description="Interno. Não aparece na loja online. Usado para calcular margem e comissão."
      >
        <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="rounded-md border border-line bg-bg-app px-3 py-2 text-sm">
              <MarginLivePreview
                costPriceInCents={costPriceInCents}
                basePriceInCents={basePriceInCents}
                showWhenEmpty
              />
            </div>
          </div>

          <div className="space-y-1.5">
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
          </div>
        </div>
      </SubCard>

      <SubCard
        title="Tributação"
        description="Mangos Pay não calcula imposto. Campo livre para integração futura com Bling/Tiny."
      >
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
            className="w-full sm:max-w-[200px]"
          />
          {errors.ncm?.message ? (
            <p className="text-destructive text-xs">{errors.ncm.message}</p>
          ) : null}
        </div>
      </SubCard>
    </div>
  );
}
