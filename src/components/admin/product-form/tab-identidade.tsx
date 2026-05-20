"use client";

// Aba "Identidade" do ProductForm — nome, descrição, classificação (marca +
// categoria) e mídia. Sub-cards: Básico, Classificação, Mídia.
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";
import type { CategoryOption } from "@/components/admin/category-dialog";
import {
  ImageUploader,
  type ProductImageData,
  type StagedImageFile,
} from "@/components/admin/image-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CategoryField, SubCard } from "./shared";

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
}

export function TabIdentidade({
  control,
  register,
  errors,
  isPending,
  productId,
  images,
  onImagesChange,
  isCreating,
  stagedFiles,
  onStagedChange,
  localCategories,
  onCategoryCreated,
}: TabIdentidadeProps) {
  return (
    <div className="flex flex-col gap-4">
      <SubCard title="Básico">
        <div className="space-y-1.5">
          <Label htmlFor="product-name">Nome</Label>
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
      </SubCard>

      <SubCard
        title="Classificação"
        description="Marca e categoria ajudam a filtrar e organizar na loja online."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-brand">Marca</Label>
            {/*
              TODO (Sprint 2): substituir por Select com botão "+ Nova marca"
              inline assim que a tabela `brand` for ativada via migration
              49_create_brand_table.sql. Por enquanto é input texto livre
              (preserva comportamento atual).
            */}
            <Input
              id="product-brand"
              placeholder="Ex: Vivara, Nike"
              disabled={isPending}
              maxLength={80}
              aria-invalid={!!errors.brand}
              {...register("brand")}
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
        </div>
      </SubCard>

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
    </div>
  );
}
