"use client";

// Aba "Variantes" do ProductForm — wrapper que monta o VariantEditor existente
// com a lista de imagens do produto pra featured image picker.
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";

import type { ProductFormValues, VariantInput } from "@/actions/product/schema";
import type { ProductImageData } from "@/components/admin/image-uploader";
import { type VariantData, VariantEditor } from "@/components/admin/variant-editor";

interface TabVariantesProps {
  control: Control<ProductFormValues>;
  isPending: boolean;
  images: ProductImageData[];
}

export function TabVariantes({ control, isPending, images }: TabVariantesProps) {
  return (
    <div className="flex flex-col gap-4">
      <Controller
        name="variants"
        control={control}
        render={({ field }) => (
          <VariantEditor
            value={field.value as VariantData[]}
            onChange={(next: VariantInput[]) => field.onChange(next)}
            disabled={isPending}
            productImages={images.map((img) => ({
              id: img.id,
              url: img.url,
            }))}
          />
        )}
      />
    </div>
  );
}
