"use client";

/**
 * Wrapper client da página /admin/produtos/novo.
 *
 * Sprint 1.1 (2026-05-22): toggle "Rápido vs Completo" removido.
 *
 * Motivos:
 *   - Quick form hardcodava trackStock=false → produto saía sem estoque
 *     (bug ativo em produção: vendedora cadastra 50 SKUs, todos
 *     publicados sem controle de estoque). Não dá pra confiar.
 *   - Completo já é leve depois da Onda 2.1 (5 abas → 3 abas + autosave).
 *     "Nome + preço + foto" cabem todos no primeiro card da Identidade.
 *
 * Modo Completo agora é o ÚNICO caminho.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BrandOption } from "@/actions/brand/types";
import { createProductFromValues } from "@/actions/product/create-from-values";
import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductForm } from "@/components/admin/product-form";

interface NewProductFormProps {
  categories: CategoryOption[];
  brands: BrandOption[];
  /** Onda 2.3 — usado pra esconder campos de moda em joia/perfume/outro. */
  storeNiche?:
    | "roupa_feminina"
    | "joia"
    | "semijoia"
    | "perfumaria"
    | "outro";
}

export function NewProductForm({
  categories,
  brands,
  storeNiche,
}: NewProductFormProps) {
  const router = useRouter();
  const [resetKey, setResetKey] = useState(0);

  return (
    <ProductForm
      key={resetKey}
      isDraft
      categories={categories}
      brands={brands}
      storeNiche={storeNiche}
      onCreateProduct={createProductFromValues}
      onAfterSave={(opts) => {
        if (opts.continueCreating) {
          setResetKey((k) => k + 1);
          router.refresh();
          return;
        }
        router.push("/admin/produtos");
        router.refresh();
      }}
      initialData={{
        productId: "new",
        name: "",
        description: "",
        basePriceInCents: 0,
        promoPriceInCents: null,
        categoryId: null,
        trackStock: false,
        stockQuantity: null,
        allowOversell: false,
        installmentsOverride: null,
        cashDiscountOverrideBps: null,
        isActive: true,
        isFeatured: false,
        isPublishedToStorefront: true,
        composition: null,
        modeling: null,
        lining: null,
        washing: null,
        wholesalePriceInCents: null,
        costPriceInCents: null,
        minStockQuantity: null,
        maxStockQuantity: null,
        gtin: null,
        brand: null,
        brandId: null,
        unit: "un",
        internalCode: null,
        defaultCommissionBps: null,
        ncm: null,
        variants: [],
        images: [],
      }}
    />
  );
}
