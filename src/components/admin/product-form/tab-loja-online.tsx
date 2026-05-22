"use client";

// Aba "Loja online" do ProductForm — publicação, overrides de catálogo, conteúdo
// do storefront (composição, modelagem, forro, lavagem).
//
// Decisão Sprint 0/Prompt 6: "atributos pra filtros (multi-select)" do spec
// fica fora — não há campo no schema ProductFormValues. Adição vira trabalho
// futuro quando o schema ganhar o campo.
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MetaField, SubCard, ToggleRow } from "./shared";

interface TabLojaOnlineProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
  isDraft: boolean;
  /**
   * Onda 2.3 — quando false (joia, semijoia, perfumaria, outro), esconde
   * Composição/Modelagem/Forro/Lavagem. Lojista de joia não preenche
   * "lavagem de colar" — campo só polui.
   */
  showApparelMetaFields?: boolean;
}

export function TabLojaOnline({
  control,
  register,
  errors,
  isPending,
  isDraft,
  showApparelMetaFields = true,
}: TabLojaOnlineProps) {
  return (
    <div className="flex flex-col gap-4">
      <SubCard
        title="Publicação"
        description="Controla onde e como o produto aparece para o público."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            isActive vive aqui só na criação (rascunho). No modo edição
            ele é controlado pelo header da página (ProductPublishToggle)
            pra publicar/pausar sem reabrir o form inteiro.
          */}
          {isDraft ? (
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <ToggleRow
                  id="product-active"
                  label="Visível na loja"
                  description="Desligado = rascunho, só você vê."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          ) : null}

          <Controller
            name="isPublishedToStorefront"
            control={control}
            render={({ field }) => (
              <ToggleRow
                id="product-published-storefront"
                label="Publicado na loja online"
                description="Se desligado, fica no estoque/PDV mas não aparece na vitrine pública."
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
                disabled={isPending}
              />
            )}
          />

          <Controller
            name="isFeatured"
            control={control}
            render={({ field }) => (
              <ToggleRow
                id="product-featured"
                label="Em destaque"
                description="Aparece em primeiro na vitrine (se publicado)."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>
      </SubCard>

      <SubCard
        title="Catálogo"
        description="Sobrescreve as configurações da loja só para este produto."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-installments-override">
              Parcelar até (sobrescreve a loja)
            </Label>
            <Controller
              name="installmentsOverride"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value === null ? "default" : String(field.value)}
                  onValueChange={(v) =>
                    field.onChange(v === "default" ? null : Number(v))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="product-installments-override"
                    className="w-full sm:max-w-[220px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Usar o padrão da loja
                    </SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}×
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-ink-4 text-xs">
              Útil pra peça mais cara que merece mais parcelas.
            </p>
            {errors.installmentsOverride?.message ? (
              <p className="text-destructive text-xs">
                {errors.installmentsOverride.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 border-t border-line pt-3">
            <Label htmlFor="product-cash-discount-override">
              Desconto à vista (sobrescreve a loja)
            </Label>
            <Controller
              name="cashDiscountOverrideBps"
              control={control}
              render={({ field }) => {
                const v = field.value;
                const mode =
                  v === null ? "default" : v === 0 ? "off" : "custom";
                const bpsValue = typeof v === "number" && v > 0 ? v : 0;
                return (
                  <div className="space-y-2">
                    <Select
                      value={mode}
                      onValueChange={(next) => {
                        if (next === "default") field.onChange(null);
                        else if (next === "off") field.onChange(0);
                        else field.onChange(bpsValue > 0 ? bpsValue : 500);
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id="product-cash-discount-override"
                        className="w-full sm:max-w-[260px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          Usar o padrão da loja
                        </SelectItem>
                        <SelectItem value="off">
                          Sem desconto neste produto
                        </SelectItem>
                        <SelectItem value="custom">
                          Definir um valor específico
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {mode === "custom" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="product-cash-discount-input"
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min={0.01}
                          max={99.99}
                          value={
                            bpsValue === 0
                              ? ""
                              : String(Math.round(bpsValue) / 100).replace(
                                  ".",
                                  ",",
                                )
                          }
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(",", ".")
                              .trim();
                            if (raw === "") {
                              field.onChange(0);
                              return;
                            }
                            const pct = Number.parseFloat(raw);
                            if (!Number.isFinite(pct) || pct < 0) {
                              field.onChange(0);
                              return;
                            }
                            field.onChange(
                              Math.min(9999, Math.round(pct * 100)),
                            );
                          }}
                          placeholder="0"
                          className="w-32"
                          disabled={isPending}
                          aria-invalid={!!errors.cashDiscountOverrideBps}
                        />
                        <span className="text-ink-4 text-sm">% off</span>
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
            <p className="text-ink-4 text-xs">
              Útil pra queima de estoque (desconto maior) ou desligar o
              desconto em produto com margem apertada.
            </p>
            {errors.cashDiscountOverrideBps?.message ? (
              <p className="text-destructive text-xs">
                {errors.cashDiscountOverrideBps.message}
              </p>
            ) : null}
          </div>
        </div>
      </SubCard>

      {/* Onda 2.3 — apenas pra moda (composição, modelagem, etc não fazem
          sentido em joia/semijoia/perfumaria). Onda 1.7 + 2.11 também
          renomeou o título do storefront. */}
      {showApparelMetaFields ? (
        <SubCard
          title="Detalhes pra ficha do produto"
          description="Aparecem na ficha do produto na vitrine pública. Tudo opcional."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaField
              id="product-composition"
              label="Composição"
              placeholder="Ex: 100% linho"
              error={errors.composition?.message}
              disabled={isPending}
              {...register("composition")}
            />
            <MetaField
              id="product-modeling"
              label="Modelagem"
              placeholder="Ex: Evasê midi"
              error={errors.modeling?.message}
              disabled={isPending}
              {...register("modeling")}
            />
            <MetaField
              id="product-lining"
              label="Forro"
              placeholder="Ex: Não possui"
              error={errors.lining?.message}
              disabled={isPending}
              {...register("lining")}
            />
            <MetaField
              id="product-washing"
              label="Lavagem"
              placeholder="Ex: À mão"
              error={errors.washing?.message}
              disabled={isPending}
              {...register("washing")}
            />
          </div>
        </SubCard>
      ) : null}
    </div>
  );
}
