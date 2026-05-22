"use client";

/**
 * Wrapper client da página /admin/produtos/[id].
 *
 * Após "Salvar", refresca o RSC pra trazer dados frescos (capa atualizada,
 * timestamps) sem navegar. Lojista permanece na página e pode continuar
 * editando. Para sair, usa o link "Produtos" do breadcrumb (ou browser
 * back — preservado pelo Next 15 navigation cache).
 *
 * `router.refresh()` envolto em `startTransition` para não bloquear o UI
 * thread (toast/feedback) enquanto o RSC re-renderiza. Padrão documentado
 * em memory `router-refresh-in-starttransition`.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { BrandOption } from "@/actions/brand/types";
import type { CategoryOption } from "@/components/admin/category-dialog";
import type { ProductImageData } from "@/components/admin/image-uploader";
import {
  ProductForm,
  type ProductFormInitialData,
} from "@/components/admin/product-form";
import type { VariantData } from "@/components/admin/variant-editor";

interface EditProductFormProps {
  initialData: ProductFormInitialData;
  categories: CategoryOption[];
  brands: BrandOption[];
  /** Onda 2.3 — passa pro form filtrar campos por tipo de loja. */
  storeNiche?:
    | "roupa_feminina"
    | "joia"
    | "semijoia"
    | "perfumaria"
    | "outro";
}

export function EditProductForm({
  initialData,
  categories,
  brands,
  storeNiche,
}: EditProductFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <ProductForm
      isDraft={false}
      categories={categories}
      brands={brands}
      storeNiche={storeNiche}
      initialData={initialData}
      onAfterSave={() => {
        // Refresh em vez de push — lojista fica na página com toggle e
        // ações disponíveis. Capa/timestamp re-renderizam em background.
        startTransition(() => {
          router.refresh();
        });
      }}
    />
  );
}

export type { ProductImageData, VariantData };
