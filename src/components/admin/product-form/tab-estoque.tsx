"use client";

// Aba "Estoque" do ProductForm — controle, quantidades, identificação.
// Sub-cards: Como controlar, Quantidades (só se controle=ON), Identificação.
//
// Débito Sprint 0/Prompt 6: o CLAUDE.md especifica "estoque atual readonly
// com link Ver movimentações". Mantido editável aqui para preservar o fluxo
// de criação (lojista precisa setar estoque inicial em algum lugar).
// Migração para readonly + lançamento de movimento na criação fica como
// trabalho futuro quando a Sprint adicionar UX de "lançamento inicial".
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import type { ProductFormValues, ProductUnit } from "@/actions/product/schema";
import { StockInput } from "@/components/admin/stock-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { SubCard } from "./shared";

// Onda 2.10 — bate com glossário CLAUDE.md (un, kg, g, m, m², L, ml, par, dúzia).
// `pc/cm/m3` permanecem no enum do DB pra produtos legados mas saíram do select.
const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "un", label: "un" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "m", label: "m" },
  { value: "m2", label: "m²" },
  { value: "L", label: "L" },
  { value: "ml", label: "ml" },
  { value: "par", label: "par" },
  { value: "duzia", label: "dúzia" },
];

interface TabEstoqueProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
}

export function TabEstoque({
  control,
  register,
  errors,
  isPending,
}: TabEstoqueProps) {
  const trackStock = useWatch({ control, name: "trackStock" });

  return (
    <div className="flex flex-col gap-4">
      <SubCard
        title="Como controlar"
        description="Deixe ligado se você conta as peças. Desligue para serviços ou produtos sob encomenda."
      >
        <Controller
          name="trackStock"
          control={control}
          render={({ field: trackField }) => (
            <Controller
              name="stockQuantity"
              control={control}
              render={({ field: qtyField }) => (
                <StockInput
                  value={{
                    trackStock: trackField.value,
                    stockQuantity: qtyField.value,
                  }}
                  onChange={(next) => {
                    trackField.onChange(next.trackStock);
                    qtyField.onChange(next.stockQuantity);
                  }}
                  disabled={isPending}
                />
              )}
            />
          )}
        />
        {errors.stockQuantity?.message ? (
          <p className="text-destructive text-xs">
            {errors.stockQuantity.message}
          </p>
        ) : null}
      </SubCard>

      {/* Onda 2.15 — permite vender mesmo zerado. Só relevante quando
          trackStock=true (sem controle, já é ilimitado). Default OFF
          preserva o bloqueio histórico de OUT_OF_STOCK no PDV. */}
      {trackStock ? (
        <SubCard
          title="Encomenda / pré-venda"
          description="Quando ligado, o PDV aceita vender mesmo se o estoque chegou a zero — útil pra peça personalizada ou pré-venda. Lojista vê aviso, mas a venda passa."
        >
          <Controller
            name="allowOversell"
            control={control}
            render={({ field }) => (
              <div className="bg-bg-app flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="product-allow-oversell"
                    className="cursor-pointer text-sm"
                  >
                    Permitir vender mesmo zerado
                  </Label>
                  <p className="text-ink-4 text-xs">
                    {field.value
                      ? "PDV mostra aviso e deixa fechar a venda."
                      : "PDV bloqueia a venda quando o saldo chega a zero (padrão)."}
                  </p>
                </div>
                <Switch
                  id="product-allow-oversell"
                  checked={field.value}
                  disabled={isPending}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        </SubCard>
      ) : null}

      {trackStock ? (
        <SubCard
          title="Quantidades"
          description="Mínimo dispara alerta de reposição. Máximo ajuda relatório de estoque parado."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-min-stock">Estoque mínimo</Label>
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
              ) : null}
              <p className="text-ink-4 text-[11px]">
                Avisa quando atingir esse número.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-max-stock">Estoque máximo</Label>
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
              ) : null}
              <p className="text-ink-4 text-[11px]">
                Limite acima do qual conta como estoque parado.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Atual</Label>
              <div className="rounded-md border border-line bg-bg-app px-3 py-2 text-sm text-ink-3">
                Editável acima · histórico em /admin/estoque
              </div>
            </div>
          </div>
        </SubCard>
      ) : null}

      <SubCard
        title="Identificação"
        description="GTIN agiliza scanner no PDV. Código interno e unidade aparecem em relatórios e cupom."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-gtin">GTIN / código de barras</Label>
            <Input
              id="product-gtin"
              {...register("gtin")}
              placeholder="EAN-13"
              disabled={isPending}
              maxLength={14}
              aria-invalid={!!errors.gtin}
              inputMode="numeric"
            />
            {errors.gtin?.message ? (
              <p className="text-destructive text-xs">{errors.gtin.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-internal-code">Código interno</Label>
            <Input
              id="product-internal-code"
              {...register("internalCode")}
              placeholder="Ex: ANE-12"
              disabled={isPending}
              maxLength={60}
              aria-invalid={!!errors.internalCode}
            />
            {errors.internalCode?.message ? (
              <p className="text-destructive text-xs">
                {errors.internalCode.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-unit">Unidade</Label>
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
            <p className="text-ink-4 text-[11px]">
              Como você conta esse produto na venda.
            </p>
          </div>
        </div>
      </SubCard>
    </div>
  );
}
