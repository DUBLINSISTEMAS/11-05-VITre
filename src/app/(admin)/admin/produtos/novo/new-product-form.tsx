"use client";

/**
 * Wrapper client da página /admin/produtos/novo.
 *
 * Migra o fluxo de criação do antigo modal pra página dedicada. Page-mode
 * ganha:
 *  - prefetch automático via <Link> (botão "+ Novo produto" baixa o JS
 *    antes do click — abertura percebida instantânea)
 *  - back navigation cache do Next 15 (router.back() volta pra lista sem
 *    re-render server)
 *  - URL `/admin/produtos/novo` compartilhável
 *
 * Navegação pós-save:
 *  - "Salvar" → router.push("/admin/produtos") (volta pra lista)
 *  - "Salvar e adicionar outro" → bump `resetKey` (remonta ProductForm
 *    vazio sem navegação)
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
}

export function NewProductForm({ categories, brands }: NewProductFormProps) {
  const router = useRouter();
  const [resetKey, setResetKey] = useState(0);

  return (
    <ProductForm
      key={resetKey}
      isDraft
      categories={categories}
      brands={brands}
      onCreateProduct={createProductFromValues}
      onAfterSave={(opts) => {
        if (opts.continueCreating) {
          // Remonta o form vazio — mesma página, sem round-trip de
          // navegação. router.refresh() invalida o cache do RSC pra
          // próxima volta à lista trazer o produto recém-criado.
          setResetKey((k) => k + 1);
          router.refresh();
          return;
        }
        router.push("/admin/produtos");
        router.refresh();
      }}
      initialData={{
        // productId efêmero — qualquer string serve, ProductForm não
        // chama uploadProductImage até persistir o produto (mode="staged").
        productId: "new",
        name: "",
        description: "",
        basePriceInCents: 0,
        promoPriceInCents: null,
        categoryId: null,
        trackStock: false,
        stockQuantity: null,
        installmentsOverride: null,
        cashDiscountOverrideBps: null,
        isActive: true,
        isFeatured: false,
        isPublishedToStorefront: true,
        composition: null,
        modeling: null,
        lining: null,
        washing: null,
        // ADR-0034 Camada 2 — defaults pra criação.
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
