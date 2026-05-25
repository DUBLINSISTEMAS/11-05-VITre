"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  DollarSignIcon,
  ImageIcon,
  LayoutGridIcon,
  Loader2Icon,
  PackageIcon,
  PlusCircleIcon,
  SaveIcon,
  StoreIcon,
  TagIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
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
import {
  clearFormDraft,
  loadFormDraft,
  useFormDraft,
} from "@/hooks/use-form-draft";
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
  /** Onda 2.15 — permite vender mesmo zerado (encomenda). */
  allowOversell: boolean;
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
  /** Espelha enum DB product_unit; default 'un' aplicado se NULL no banco.
   *  par/duzia adicionados SQL 61 (Onda 2.10). pc/cm/m3 mantidos pra
   *  produtos legados mas escondidos do select (ver tab-estoque.tsx). */
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
    | "m3"
    | "par"
    | "duzia";
  internalCode: string | null;
  defaultCommissionBps: number | null;
  ncm: string | null;
  variants: VariantData[];
  images: ProductImageData[];
}

interface ProductFormProps {
  initialData: ProductFormInitialData;
  /**
   * Onda 2.3 (2026-05-22) — tipo de loja do onboarding. Usado pra esconder
   * campos irrelevantes (ex: "Modelagem", "Forro", "Lavagem" só fazem
   * sentido pra roupa; em joia/semijoia/perfumaria saem). Quando `undefined`,
   * mostra todos os campos (fallback conservador).
   */
  storeNiche?: "roupa_feminina" | "joia" | "semijoia" | "perfumaria" | "outro";
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

// PP1 (handoff pixel-perfect 2026-05-25): 6 abas com sidebar 180px à
// esquerda + form panel à direita. Bate o ProductFormDrawer do bundle
// (drawers.jsx linha 209-216).
const TAB_NAV: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "basico", label: "Básico", icon: TagIcon },
  { key: "imagens", label: "Imagens", icon: ImageIcon },
  { key: "preco", label: "Preço & custo", icon: DollarSignIcon },
  { key: "estoque", label: "Estoque", icon: PackageIcon },
  { key: "variantes", label: "Variantes", icon: LayoutGridIcon },
  { key: "loja", label: "Loja online", icon: StoreIcon },
];

/**
 * Form de edição/criação de produto.
 *
 * PP1 redesign 2026-05-25: 6 abas em sidebar vertical 180px à esquerda
 * (bate drawers.jsx do handoff). Antes era 3 abas horizontais.
 *   1. Básico       — Nome, descrição, classificação (marca+categoria)
 *   2. Imagens      — ImageUploader (extraído da Identidade)
 *   3. Preço & custo — Venda + custo + margem live + simulador markup/margem
 *   4. Estoque      — Controle on/off + qty + min/max + localização
 *   5. Variantes    — VariantEditor standalone (antes era dobrável)
 *   6. Loja online  — Publicação + promo + atacado + comissão + NCM + apparel
 *
 * Comportamento preservado: Zod schema, server actions, staged uploads,
 * cadastro contínuo via sessionStorage, sticky save mobile/desktop,
 * isActive controlado pelo header em modo edit.
 *
 * Layout muda: grid `[180px_1fr]` em lg+, vertical stack em mobile (tabs
 * em scroll horizontal no mobile).
 *
 * Débitos documentados nos arquivos de cada aba:
 *   - "+ Nova marca" inline (Sprint 2, depende da tabela `brand`)
 *   - "atributos pra filtros" multi-select (PP6 schema novo)
 */
export function ProductForm({
  initialData,
  categories,
  brands,
  isDraft,
  onAfterSave,
  onCreateProduct,
  storeNiche,
}: ProductFormProps) {
  // Onda 2.3 — campos "Composição/Modelagem/Forro/Lavagem" só fazem
  // sentido pra roupa. Pra joia, semijoia, perfumaria, outro: escondemos.
  const showApparelMetaFields = storeNiche === "roupa_feminina";
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
    setValue,
    watch,
    reset,
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
      allowOversell: initialData.allowOversell,
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
  const [activeTab, setActiveTab] = useState<TabKey>("basico");

  // Onda 2.9 (2026-05-22) — autosave de rascunho. Só faz sentido em
  // criação (modo Detalhado de novo produto). Em edit o estado do form
  // bate com o banco; salvar localStorage em paralelo confundiria mais
  // do que ajudaria. Limpamos no submit ok mais abaixo.
  const draftKey = "product-create";
  const watchedValues = watch();
  useFormDraft(draftKey, watchedValues, { skip: !isCreating });

  // Restore: se há rascunho recente, oferece via toast UMA vez por mount.
  // Heurística simples — só oferece se o nome veio vazio (initialData de
  // criação) e o draft tem nome preenchido.
  const restoreOfferedRef = useRef(false);
  useEffect(() => {
    if (!isCreating || restoreOfferedRef.current) return;
    if (initialData.name !== "") return;
    const draft = loadFormDraft<ProductFormValues>(draftKey);
    if (!draft || !draft.name || draft.name.trim() === "") return;
    restoreOfferedRef.current = true;
    toast("Rascunho encontrado", {
      description: `"${draft.name.slice(0, 40)}" — restaurar o que você estava cadastrando?`,
      duration: 12000,
      action: {
        label: "Restaurar",
        onClick: () => reset(draft),
      },
      cancel: {
        label: "Descartar",
        onClick: () => clearFormDraft(draftKey),
      },
    });
    // Disable warning de exhaustive-deps — reset/initialData.name é estável aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating]);

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

        // Onda 2.9 — rascunho serviu, limpa pra não reaparecer depois.
        if (isCreating) clearFormDraft(draftKey);

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
      // Padding-bottom em mobile pra clear do sticky save mobile (3.5rem nav +
      // 0.25rem gap + altura do save). Desktop: pb-28 pra clear da bottom
      // action bar fixa (h-20 + buffer). PP1: form vai full-width até xl
      // (1280px) e usa layout sidebar 180px + form panel à direita.
      className="mx-auto pb-36 lg:pb-28 xl:max-w-[1280px]"
    >
      {/* PP1 (handoff 2026-05-25): layout grid sidebar 180px + form panel.
          Em mobile (<lg) cai pra tabs horizontais scrolláveis no topo +
          form embaixo. */}
      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-6">
        {/* === Navegação de abas — sidebar vertical em lg+, horizontal mobile === */}
        <nav
          className={cn(
            "b3-tabs mb-6 lg:mb-0",
            "lg:flex lg:flex-col lg:gap-1 lg:bg-bg-app lg:rounded-[10px] lg:p-1.5 lg:self-start lg:sticky lg:top-4",
          )}
          role="tablist"
          aria-label="Seções do produto"
        >
          {TAB_NAV.map((tab) => {
            const errCount = getTabErrorCount(tab.key, errors);
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-active={isActive ? "true" : undefined}
                className={cn(
                  "b3-tab",
                  // No desktop, cada tab vira row 9px 12px com active wash.
                  "lg:!flex lg:w-full lg:items-center lg:gap-2.5 lg:rounded-[8px] lg:px-3 lg:py-2.5 lg:text-left lg:text-[13px] lg:font-medium",
                  "lg:!border-0",
                  isActive
                    ? "lg:!bg-surface lg:!text-mangos-green-900 lg:font-semibold lg:shadow-sm"
                    : "lg:!bg-transparent lg:text-ink-2 lg:hover:bg-bg-app lg:hover:text-ink-1",
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "lg:text-mangos-yellow-hover" : "lg:text-ink-4",
                  )}
                />
                <span className="lg:flex-1">{tab.label}</span>
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
        </nav>

        {/* === Form panel — 6 seções, uma visível por vez === */}
        <div className="min-w-0">
          <div hidden={activeTab !== "basico"} className="space-y-4">
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
                setLocalBrands((prev) =>
                  [...prev, b].sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              view="basico"
            />
          </div>

          <div hidden={activeTab !== "imagens"} className="space-y-4">
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
                setLocalBrands((prev) =>
                  [...prev, b].sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              view="imagens"
            />
          </div>

          <div hidden={activeTab !== "preco"} className="space-y-4">
            <TabPrecoCusto
              control={control}
              register={register}
              errors={errors}
              isPending={isPending}
              setValue={setValue}
              hideAdvanced
            />
          </div>

          <div hidden={activeTab !== "estoque"} className="space-y-4">
            <TabEstoque
              control={control}
              register={register}
              errors={errors}
              isPending={isPending}
              isCreating={isCreating}
              originalStockQuantity={initialData.stockQuantity}
            />
          </div>

          <div hidden={activeTab !== "variantes"} className="space-y-4">
            <TabVariantes
              control={control}
              isPending={isPending}
              images={images}
            />
          </div>

          <div hidden={activeTab !== "loja"} className="space-y-4">
            <div className="rounded-xl border border-dashed border-line bg-bg-app p-3 text-[12.5px] text-ink-4">
              Publicação na vitrine, promoção, atacado, comissão, NCM e
              metadados editoriais (composição, modelagem, forro, lavagem
              quando aplicável).
            </div>
            <TabLojaOnline
              control={control}
              register={register}
              errors={errors}
              isPending={isPending}
              isDraft={isDraft}
              showApparelMetaFields={showApparelMetaFields}
            />
            <TabPrecoCusto
              control={control}
              register={register}
              errors={errors}
              isPending={isPending}
              setValue={setValue}
              onlyAdvanced
            />
          </div>
        </div>
      </div>

      {/* === Bottom action bar desktop (sticky no rodapé, ≥lg) ===
           Cobre o main full-width; em desktop a sidebar (280px) fica
           descoberta visualmente. Cancelar volta pra lista; Salvar
           preserva fluxo de "Salvar e adicionar outro" em rascunho. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 hidden lg:flex",
          "border-t border-mangos-border bg-white/90 backdrop-blur",
          "lg:left-[280px]",
        )}
      >
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-end gap-3 px-8 py-4">
          {isDraft ? (
            <Button
              type="submit"
              variant="outline"
              disabled={isPending}
              onClick={() => setSubmitMode("saveAndContinue")}
              className="h-11"
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
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => router.push("/admin/produtos")}
              className="h-11 px-6"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={isPending}
            onClick={() => setSubmitMode("save")}
            className="h-11 min-w-[220px]"
            size="lg"
          >
            {isPending && submitMode === "save" ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <SaveIcon /> Salvar produto
              </>
            )}
          </Button>
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
