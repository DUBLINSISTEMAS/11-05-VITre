"use client";

/**
 * Wrapper client da página /admin/produtos/[id].
 *
 * Após "Salvar", refresca o RSC pra trazer dados frescos (capa atualizada,
 * timestamps) sem navegar. Lojista permanece na página e pode continuar
 * editando. Para sair, usa o link "Produtos" do breadcrumb (ou browser
 * back — preservado pelo Next 15 navigation cache).
 */
import { useRouter } from "next/navigation";

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
}

export function EditProductForm({ initialData, categories }: EditProductFormProps) {
  const router = useRouter();
  return (
    <ProductForm
      isDraft={false}
      categories={categories}
      initialData={initialData}
      onAfterSave={() => {
        // Refresh em vez de push — lojista fica na página com toggle e
        // ações disponíveis. Capa/timestamp re-renderizam.
        router.refresh();
      }}
    />
  );
}

export type { ProductImageData, VariantData };
