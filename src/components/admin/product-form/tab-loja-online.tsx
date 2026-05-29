"use client";

// Aba "Loja online" do ProductForm — publicação e conteúdo editorial do
// storefront (composição, modelagem, forro, lavagem).
//
// Ressignificação 2026-05-27 — os 2 overrides (installmentsOverride +
// cashDiscountOverrideBps) saíram daqui pra aba "Preço & Custo" (bloco
// Avançado). Razão: ambos afetam TODOS os canais (PDV, WhatsApp, vitrine),
// não só a loja online. Aqui agora ficam SOMENTE campos exclusivos da
// vitrine pública (publicação + meta editorial).
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";

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
                  label="Ativo para venda"
                  description="Desligado = pausado em todos os canais (PDV, WhatsApp e loja online)."
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
                checked={field.value ?? false}
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
