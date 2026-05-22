"use client";

/**
 * Wrapper client da página /admin/produtos/novo.
 *
 * Sprint 2D: toggle "Rápido" vs "Completo".
 *   - Rápido: nome + preço + foto (3 campos). Pra cadastro em massa.
 *   - Completo: form de 5 abas. Pra peça que merece todos os campos.
 *
 * Preferência do lojista persistida em sessionStorage (Mangos Pay:product-create-mode).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { BrandOption } from "@/actions/brand/types";
import { createProductFromValues } from "@/actions/product/create-from-values";
import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductForm } from "@/components/admin/product-form";
import { QuickProductForm } from "@/components/admin/quick-product-form";
import { cn } from "@/lib/utils";

const MODE_KEY = "Mangos Pay:product-create-mode";
type Mode = "quick" | "full";

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
  const [mode, setMode] = useState<Mode>("quick");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(MODE_KEY);
    if (saved === "quick" || saved === "full") setMode(saved);
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(MODE_KEY, next);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toggle Rápido | Completo */}
      <div className="b3-tabs" role="tablist" aria-label="Modo de criação">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "quick"}
          data-active={mode === "quick" ? "true" : undefined}
          className={cn("b3-tab")}
          onClick={() => changeMode("quick")}
        >
          Rápido
          <span className="text-ink-4 ml-1 text-[10.5px]">3 campos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "full"}
          data-active={mode === "full" ? "true" : undefined}
          className="b3-tab"
          onClick={() => changeMode("full")}
        >
          Completo
          <span className="text-ink-4 ml-1 text-[10.5px]">5 abas</span>
        </button>
      </div>

      {mode === "quick" ? (
        <QuickProductForm
          key={resetKey}
          onAfterSave={(opts) => {
            if (opts.continueCreating) {
              setResetKey((k) => k + 1);
              router.refresh();
              return;
            }
            router.push("/admin/produtos");
            router.refresh();
          }}
        />
      ) : (
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
      )}
    </div>
  );
}
