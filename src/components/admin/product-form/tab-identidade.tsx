"use client";

// Aba "Identidade" do ProductForm — nome, descrição, classificação (marca +
// categoria) e mídia. Sub-cards: Básico, Classificação, Mídia.
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
  // Sprint 2A — marca
  localBrands: BrandOption[];
  onBrandCreated: (b: BrandOption) => void;
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
  localBrands,
  onBrandCreated,
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
              Sprint 2A — BrandField permite escolher marca cadastrada OU
              digitar texto livre. Quando escolhe do select: brandId + brand
              (snapshot do nome). Quando digita: brandId=null, brand=texto.
              Botão "+ Nova marca" abre dialog inline.
            */}
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
