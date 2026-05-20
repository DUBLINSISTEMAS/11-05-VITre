"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusCircleIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { BrandOption } from "@/actions/brand/types";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/actions/product/schema";
import { updateProduct } from "@/actions/product/update";
import { uploadProductImage } from "@/actions/product/upload-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  type CategoryOption,
} from "./category-dialog";
import {
  type ProductImageData,
  type StagedImageFile,
} from "./image-uploader";
import {
  bumpSessionCounter,
  getTabErrorCount,
  type TabKey,
} from "./product-form/shared";
import { TabEstoque } from "./product-form/tab-estoque";
import { TabIdentidade } from "./product-form/tab-identidade";
import { TabLojaOnline } from "./product-form/tab-loja-online";
import { TabPrecoCusto } from "./product-form/tab-preco-custo";
import { TabVariantes } from "./product-form/tab-variantes";
import { type VariantData } from "./variant-editor";

export interface ProductFormInitialData {
  productId: string;
  name: string;
  description: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  categoryId: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
  /**
   * Override do max-parcelas APENAS pra este produto. null = usa
   * default da loja (`store.cardMaxInstallments`). Fase 2 — ADR-0013.
   */
  installmentsOverride: number | null;
  /**
   * Override do desconto à vista APENAS pra este produto, em basis points.
   * null = usa default da loja (`store.cashDiscountBps`). 0 também é
   * override válido (= sem desconto neste produto mesmo que loja ofereça).
   * Fase 2 — ADR-0013.
   */
  cashDiscountOverrideBps: number | null;
  isActive: boolean;
  isFeatured: boolean;
  /**
   * ADR-0030 (Frente B) — Publicado na loja online?
   * Padrão true em produtos antigos (backfill via default true do DB).
   */
  isPublishedToStorefront: boolean;
  /** Meta-fields canvas-v1 — null quando lojista não preencheu. */
  composition: string | null;
  modeling: string | null;
  lining: string | null;
  washing: string | null;
  // ADR-0034 Camada 2 — campos de gestão. Todos opcionais; null = não cadastrado.
  wholesalePriceInCents: number | null;
  costPriceInCents: number | null;
  minStockQuantity: number | null;
  maxStockQuantity: number | null;
  gtin: string | null;
  brand: string | null;
  /** Sprint 2A: FK opcional pra brand.id. NULL quando texto livre. */
  brandId: string | null;
  /** Espelha enum DB product_unit; default 'un' aplicado se NULL no banco. */
  unit:
    | "un"
    | "pc"
    | "kg"
    | "g"
    | "m"
    | "cm"
    | "ml"
    | "L"
    | "m2"
    | "m3";
  internalCode: string | null;
  defaultCommissionBps: number | null;
  ncm: string | null;
  variants: VariantData[];
  images: ProductImageData[];
}

interface ProductFormProps {
  initialData: ProductFormInitialData;
  /** Lista de categorias da loja, pra popular o Select. Pode ser vazia. */
  categories: CategoryOption[];
  /**
   * Lista de marcas da loja, pra popular o Select de marca. Pode ser vazia.
   * Sprint 2A: passada do page (loadBrands). Manager inline cria/edita
   * marcas direto do form sem perder estado do produto.
   */
  brands: BrandOption[];
  /**
   * Produto é rascunho (sem nome ou slug `draft-*`)? Define se o botão
   * "Salvar e adicionar outro" aparece — fluxo de cadastro contínuo só
   * faz sentido pra produto novo.
   */
  isDraft: boolean;
  /**
   * Callback chamado após save bem-sucedido. O pai decide pra onde ir.
   */
  onAfterSave?: (opts: { continueCreating?: boolean }) => void;
  /**
   * Cria produto sob demanda no fluxo de novo produto.
   */
  onCreateProduct?: (
    values: ProductFormValues,
  ) => Promise<{ ok: true; productId: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }>;
}

const TAB_NAV: { key: TabKey; label: string }[] = [
  { key: "identidade", label: "Identidade" },
  { key: "preco-custo", label: "Preço & Custo" },
  { key: "estoque", label: "Estoque" },
  { key: "variantes", label: "Variantes" },
  { key: "loja-online", label: "Loja online" },
];

/**
 * Form de edição/criação de produto — Sprint 0/Prompt 6.
 *
 * Refator de 5 abas (princípios 8 e 9 do CLAUDE.md):
 *   1. Identidade    — Básico, Classificação (marca + categoria), Mídia
 *   2. Preço & Custo — Venda (3 col), Custo (3 col), Tributação (NCM)
 *   3. Estoque       — Controle, Quantidades (condicional), Identificação
 *   4. Variantes     — VariantEditor
 *   5. Loja online   — Publicação, Catálogo (parcelas/desconto), Conteúdo
 *
 * Comportamento atual 100% preservado: Zod schema, server actions, staged
 * uploads, cadastro contínuo via sessionStorage, sticky save mobile/desktop,
 * isActive controlado pelo header em modo edit.
 *
 * Débitos documentados nos arquivos de cada aba:
 *   - "+ Nova marca" inline (Sprint 2, depende da tabela `brand`)
 *   - "atributos pra filtros" multi-select (Sprint futura, schema)
 *   - "estoque atual readonly + Ver movimentações" (Sprint futura, UX
 *     de lançamento inicial)
 */
export function ProductForm({
  initialData,
  categories,
  brands,
  isDraft,
  onAfterSave,
  onCreateProduct,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const [images, setImages] = useState<ProductImageData[]>(initialData.images);
  const [localCategories, setLocalCategories] =
    useState<CategoryOption[]>(categories);
  // Sprint 2A — lista local de marcas (sincronizada com cadastro inline
  // de nova marca via BrandField).
  const [localBrands, setLocalBrands] = useState<BrandOption[]>(brands);
  const [stagedFiles, setStagedFiles] = useState<StagedImageFile[]>([]);
  const isCreating = !!onCreateProduct;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setError,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description,
      basePriceInCents: initialData.basePriceInCents,
      promoPriceInCents: initialData.promoPriceInCents,
      categoryId: initialData.categoryId,
      trackStock: initialData.trackStock,
      stockQuantity: initialData.stockQuantity,
      installmentsOverride: initialData.installmentsOverride,
      cashDiscountOverrideBps: initialData.cashDiscountOverrideBps,
      isActive: initialData.isActive,
      isFeatured: initialData.isFeatured,
      isPublishedToStorefront: initialData.isPublishedToStorefront,
      composition: initialData.composition ?? "",
      modeling: initialData.modeling ?? "",
      lining: initialData.lining ?? "",
      washing: initialData.washing ?? "",
      wholesalePriceInCents: initialData.wholesalePriceInCents,
      costPriceInCents: initialData.costPriceInCents,
      minStockQuantity: initialData.minStockQuantity,
      maxStockQuantity: initialData.maxStockQuantity,
      gtin: initialData.gtin ?? "",
      brand: initialData.brand ?? "",
      brandId: initialData.brandId,
      unit: initialData.unit,
      internalCode: initialData.internalCode ?? "",
      defaultCommissionBps: initialData.defaultCommissionBps,
      ncm: initialData.ncm ?? "",
      variants: initialData.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceInCents: v.priceInCents,
        stockQuantity: v.stockQuantity,
        axis: v.axis,
        colorHex: v.colorHex ?? "",
        featuredImageId: v.featuredImageId ?? null,
      })),
    },
  });

  const [submitMode, setSubmitMode] = useState<"save" | "saveAndContinue">(
    "save",
  );
  const [activeTab, setActiveTab] = useState<TabKey>("identidade");

  const onSubmit = (values: ProductFormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result = onCreateProduct
          ? await onCreateProduct(values)
          : await updateProduct({ productId: initialData.productId, ...values });
        if (!result.ok) {
          applyFieldErrors(result.fieldErrors);
          toast.error(result.error);
          return;
        }

        // ============================================================
        // STAGED FLUSH — só em criação, após produto persistido.
        // ============================================================
        const filesToFlush = stagedFiles;
        let uploadOk = 0;
        let uploadFail = 0;
        if (isCreating && filesToFlush.length > 0 && "productId" in result) {
          const newProductId = result.productId;
          const uploads = await Promise.allSettled(
            filesToFlush.map(async (s) => {
              const fd = new FormData();
              fd.append("file", s.file);
              fd.append("productId", newProductId);
              const r = await uploadProductImage(fd);
              if (!r.ok) throw new Error(r.error);
            }),
          );
          for (const u of uploads) {
            if (u.status === "fulfilled") uploadOk += 1;
            else uploadFail += 1;
          }
          filesToFlush.forEach((s) => URL.revokeObjectURL(s.previewUrl));
          setStagedFiles([]);
        }

        // Toast contextual: bem-sucedido / parcial / sem fotos.
        if (isCreating) {
          if (filesToFlush.length === 0) {
            toast.success(
              "Produto salvo. Adicione fotos depois — produtos com foto vendem mais.",
            );
          } else if (uploadFail === 0) {
            toast.success(
              `Produto salvo com ${uploadOk} ${uploadOk === 1 ? "foto" : "fotos"}.`,
            );
          } else if (uploadOk > 0) {
            toast.warning(
              `Produto salvo. ${uploadOk} de ${filesToFlush.length} fotos enviadas. Reenvie as que falharam editando o produto.`,
            );
          } else {
            toast.warning(
              "Produto salvo, mas nenhuma foto subiu. Tente reenviar editando o produto.",
            );
          }
        } else {
          toast.success("Produto salvo.");
        }

        if (submitMode === "save") {
          if (onAfterSave) {
            onAfterSave({});
          } else {
            router.refresh();
          }
          return;
        }

        const count = bumpSessionCounter();
        toast.success(
          `Pronto pro próximo. (${count} ${count === 1 ? "nesta série" : "nesta série"})`,
        );
        if (onAfterSave) {
          onAfterSave({ continueCreating: true });
        } else {
          router.refresh();
        }
      } finally {
        submittingRef.current = false;
      }
    });
  };

  function applyFieldErrors(fieldErrors: Record<string, string> | undefined) {
    if (!fieldErrors) return;
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof ProductFormValues, { message });
    }
  }

  const handleImagesChange = useCallback((next: ProductImageData[]) => {
    setImages(next);
  }, []);

  const handleCategoryCreated = useCallback(
    (c: { id: string; name: string; slug: string; parentId: string | null }) => {
      const next: CategoryOption = {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
      };
      setLocalCategories((prev) => [...prev, next]);
    },
    [],
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // Padding-bottom em mobile pra conteúdo não ficar atrás do sticky save.
      className="mx-auto max-w-[760px] pb-36 lg:pb-4"
    >
      {/* === Navegação de abas === */}
      <div
        className="b3-tabs mb-4"
        role="tablist"
        aria-label="Seções do produto"
      >
        {TAB_NAV.map((tab) => {
          const errCount = getTabErrorCount(tab.key, errors);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? "true" : undefined}
              className="b3-tab"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {errCount > 0 ? (
                <span
                  aria-label={`${errCount} ${errCount === 1 ? "erro" : "erros"}`}
                  className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
                >
                  {errCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* === Conteúdo das abas (hidden style preserva form state) === */}
      <div hidden={activeTab !== "identidade"}>
        <TabIdentidade
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
          productId={initialData.productId}
          images={images}
          onImagesChange={handleImagesChange}
          isCreating={isCreating}
          stagedFiles={stagedFiles}
          onStagedChange={setStagedFiles}
          localCategories={localCategories}
          onCategoryCreated={handleCategoryCreated}
          localBrands={localBrands}
          onBrandCreated={(b) =>
            setLocalBrands((prev) => [...prev, b].sort((a, b) => a.name.localeCompare(b.name)))
          }
        />
      </div>

      <div hidden={activeTab !== "preco-custo"}>
        <TabPrecoCusto
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      </div>

      <div hidden={activeTab !== "estoque"}>
        <TabEstoque
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      </div>

      <div hidden={activeTab !== "variantes"}>
        <TabVariantes control={control} isPending={isPending} images={images} />
      </div>

      <div hidden={activeTab !== "loja-online"}>
        <TabLojaOnline
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
          isDraft={isDraft}
        />
      </div>

      {/* === Save desktop (inline ao final do form, ≥lg) === */}
      <div className="mt-6 hidden flex-col items-end gap-2 lg:flex">
        <div className={cn("flex w-full max-w-[400px] flex-col gap-2")}>
          <Button
            type="submit"
            disabled={isPending}
            onClick={() => setSubmitMode("save")}
            className="w-full"
            size="lg"
          >
            {isPending && submitMode === "save" ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <SaveIcon /> Salvar
              </>
            )}
          </Button>
          {isDraft ? (
            <Button
              type="submit"
              variant="outline"
              disabled={isPending}
              onClick={() => setSubmitMode("saveAndContinue")}
              className="w-full"
            >
              {isPending && submitMode === "saveAndContinue" ? (
                <>
                  <Loader2Icon className="animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <PlusCircleIcon /> Salvar e adicionar outro
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* === Save mobile sticky (acima do bottom nav) === */}
      <div
        className="surface-elevated fixed inset-x-0 z-50 flex flex-col gap-2 px-4 py-3 lg:hidden"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
        }}
      >
        {isDraft ? (
          <Button
            type="submit"
            variant="outline"
            disabled={isPending}
            onClick={() => setSubmitMode("saveAndContinue")}
            className="w-full"
          >
            {isPending && submitMode === "saveAndContinue" ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <PlusCircleIcon /> Salvar e adicionar outro
              </>
            )}
          </Button>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          onClick={() => setSubmitMode("save")}
          className="w-full"
          size="lg"
        >
          {isPending && submitMode === "save" ? (
            <>
              <Loader2Icon className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon /> Salvar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
