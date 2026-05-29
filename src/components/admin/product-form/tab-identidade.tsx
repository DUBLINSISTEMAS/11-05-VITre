"use client";

// Aba "Identidade" do ProductForm — nome, descrição, classificação (marca +
// categoria) e mídia. Sub-cards: Básico, Classificação, Mídia.
//
// PP1 (handoff pixel-perfect 2026-05-25): suporta 3 modos de view:
//   - "all"     → 3 sub-cards num grid 12-col xl (legacy 3-aba)
//   - "basico"  → Básico + Classificação stacked single-col (sem Mídia)
//   - "imagens" → Mídia somente
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller } from "react-hook-form";

import type { BrandOption } from "@/actions/brand/types";
import type { ProductFormValues } from "@/actions/product/schema";
import { BrandField } from "@/components/admin/brand-field";
import type { CategoryOption } from "@/components/admin/category-dialog";
import {
  ImageUploader,
  type ProductImageData,
  type StagedImageFile,
} from "@/components/admin/image-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { CategoryField, SubCard } from "./shared";

/**
 * Bloco B da ressignificação — 3 universos de produto. Label voltado pro
 * lojista BR (não jargão técnico). Helper text contextualiza cada opção
 * com exemplo concreto do ICP varejo (joalheria + roupa + perfumaria).
 */
const KIND_OPTIONS: Array<{
  value: "raw_material" | "finished_good" | "service";
  label: string;
  helper: string;
}> = [
  {
    value: "finished_good",
    label: "Produto pra venda",
    helper: "Comum: vende no balcão, WhatsApp ou loja online.",
  },
  {
    value: "raw_material",
    label: "Item de gestão",
    helper:
      "Matéria-prima, mostruário, ativo. Tem custo e ocupa estoque, mas não aparece pra venda.",
  },
  {
    value: "service",
    label: "Serviço",
    helper:
      "Conserto, limpeza, instalação. Sem estoque físico — só preço e tempo.",
  },
];

interface TabIdentidadeProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
  // ImageUploader integration
  productId: string;
  images: ProductImageData[];
  onImagesChange: (next: ProductImageData[]) => void;
  isCreating: boolean;
  stagedFiles: StagedImageFile[];
  onStagedChange: (next: StagedImageFile[]) => void;
  // Categoria dialog
  localCategories: CategoryOption[];
  onCategoryCreated: (c: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }) => void;
  // Sprint 2A — marca
  localBrands: BrandOption[];
  onBrandCreated: (b: BrandOption) => void;
  /** PP1 — qual subset renderizar. Default "all" (legacy 3-aba). */
  view?: "all" | "basico" | "imagens";
}

export function TabIdentidade(props: TabIdentidadeProps) {
  const view = props.view ?? "all";

  if (view === "imagens") {
    return <MediaSubCard {...props} />;
  }

  if (view === "basico") {
    // PP1 — modo drawer single-col: Básico em cima, Classificação embaixo.
    return (
      <div className="flex flex-col gap-4">
        <BasicoSubCard {...props} />
        <ClassificacaoSubCard {...props} />
      </div>
    );
  }

  // Modo "all" (legacy 3-aba): grid 12-col xl, Básico+Mídia esquerda 7
  // colunas + Classificação direita 5 colunas. Princípio 9 — inteligência
  // espacial: campo curto não estica, agrupamento visual.
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
      <div className="flex flex-col gap-4 xl:col-span-7">
        <BasicoSubCard {...props} />
        <MediaSubCard {...props} />
      </div>
      <div className="flex flex-col gap-4 xl:col-span-5">
        <ClassificacaoSubCard {...props} />
      </div>
    </div>
  );
}

// ---- Sub-cards extraídos pra evitar branching de JSX dinâmico (que
// causou OOM no tsc com union types). Cada um é puro: recebe props,
// retorna SubCard. ----

function BasicoSubCard({
  control,
  register,
  errors,
  isPending,
}: TabIdentidadeProps) {
  return (
    <SubCard title="Básico">
      {/* Bloco D UX (2026-05-28) — antes "Tipo" vinha PRIMEIRO, antes do
          nome. Joalheiro recém-chegado parava 30s pensando entre
          matéria-prima/produto/serviço sem ter ainda nem o nome do
          produto na cabeça. Agora: Nome > Descrição > Tipo (com label
          "avançado" pra sinalizar que 95% deixa default). */}
      <div className="space-y-1.5">
        <Label htmlFor="product-name" required>
          Nome
        </Label>
        <Input
          id="product-name"
          placeholder="Ex: Vestido midi preto"
          disabled={isPending}
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name?.message ? (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-description">Descrição</Label>
        <Textarea
          id="product-description"
          placeholder="Detalhes, medidas, material…"
          rows={4}
          disabled={isPending}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description?.message ? (
          <p className="text-destructive text-xs">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-kind">
          Tipo de produto{" "}
          <span className="text-ink-4 font-normal text-[11px]">(avançado)</span>
        </Label>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => {
            const current = KIND_OPTIONS.find((o) => o.value === field.value);
            return (
              <>
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="product-kind"
                    aria-invalid={!!errors.kind}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {current ? (
                  <p className="text-ink-4 text-xs">{current.helper}</p>
                ) : (
                  <p className="text-ink-4 text-xs">
                    Default: produto pra venda. Mude só se for matéria-prima
                    (ouro 18k, mostruário) ou serviço.
                  </p>
                )}
              </>
            );
          }}
        />
        {errors.kind?.message ? (
          <p className="text-destructive text-xs">{errors.kind.message}</p>
        ) : null}
      </div>
    </SubCard>
  );
}

function MediaSubCard({
  productId,
  images,
  onImagesChange,
  isCreating,
  stagedFiles,
  onStagedChange,
  isPending,
}: TabIdentidadeProps) {
  return (
    <SubCard
      title="Mídia"
      description="A primeira foto vira a capa. Tire pelo celular ou escolha da galeria."
    >
      <ImageUploader
        productId={productId}
        images={images}
        onChange={onImagesChange}
        mode={isCreating ? "staged" : "server"}
        stagedFiles={stagedFiles}
        onStagedChange={onStagedChange}
        disabled={isPending}
      />
    </SubCard>
  );
}

function ClassificacaoSubCard({
  control,
  errors,
  isPending,
  localBrands,
  onBrandCreated,
  localCategories,
  onCategoryCreated,
}: TabIdentidadeProps) {
  return (
    <SubCard
      title="Classificação"
      description="Marca e categoria ajudam a filtrar e organizar na loja online."
    >
      <div className="space-y-1.5">
        <Label htmlFor="product-brand">Marca</Label>
        {/* Sprint 2A — BrandField permite escolher marca cadastrada OU
            digitar texto livre. brandId+brand controlled via dois
            Controllers aninhados. */}
        <Controller
          name="brandId"
          control={control}
          render={({ field: brandIdField }) => (
            <Controller
              name="brand"
              control={control}
              render={({ field: brandTextField }) => (
                <BrandField
                  brandId={brandIdField.value ?? null}
                  brandText={brandTextField.value ?? ""}
                  brands={localBrands}
                  disabled={isPending}
                  onChange={(next) => {
                    brandIdField.onChange(next.brandId);
                    brandTextField.onChange(next.brandText);
                  }}
                  onBrandCreated={(b) => {
                    onBrandCreated(b);
                    brandIdField.onChange(b.id);
                    brandTextField.onChange(b.name);
                  }}
                />
              )}
            />
          )}
        />
        {errors.brand?.message ? (
          <p className="text-destructive text-xs">{errors.brand.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-category">Categoria</Label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <CategoryField
              value={field.value}
              onChange={field.onChange}
              categories={localCategories}
              disabled={isPending}
              onCategoryCreated={(c) => {
                onCategoryCreated(c);
                field.onChange(c.id);
              }}
            />
          )}
        />
      </div>
    </SubCard>
  );
}
