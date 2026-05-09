"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusCircleIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveAndCreateNext } from "@/actions/product/save-and-create-next";
import {
  productFormSchema,
  type ProductFormValues,
  type VariantInput,
} from "@/actions/product/schema";
import { updateProduct } from "@/actions/product/update";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  CategoryDialog,
  type CategoryOption,
} from "./category-dialog";
import { ImageUploader, type ProductImageData } from "./image-uploader";
import { PriceInput } from "./price-input";
import { StockInput } from "./stock-input";
import { type VariantData,VariantEditor } from "./variant-editor";

export interface ProductFormInitialData {
  productId: string;
  name: string;
  description: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  categoryId: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
  isActive: boolean;
  isFeatured: boolean;
  variants: VariantData[];
  images: ProductImageData[];
}

interface ProductFormProps {
  initialData: ProductFormInitialData;
  /** Lista de categorias da loja, pra popular o Select. Pode ser vazia. */
  categories: CategoryOption[];
  /**
   * Produto é rascunho (sem nome ou slug `draft-*`)? Define se o botão
   * "Salvar e adicionar outro" aparece — fluxo de cadastro contínuo só
   * faz sentido pra produto novo. Editar produto existente: só "Salvar".
   */
  isDraft: boolean;
}

/**
 * Form de edição/criação de produto. Recebe `initialData` já carregada do
 * servidor (a página /editar faz o fetch). RHF + Zod com diff de variantes
 * delegado pra server action.
 *
 * UX:
 * - Cards FormSection na ordem cognitiva da Sandra (foto → nome → preço → ...)
 * - Save sticky no bottom em mobile (acima do bottom nav fixo)
 * - useCallback nos onChange dos controllers caros (Image/Variant) — evita
 *   re-render em cada keystroke do nome.
 *
 * `isActive` fica FORA deste form (toggle no header da página, action separada).
 * `images` fica fora do form do RHF — gerenciadas em state separado, persistidas
 *   pelas actions `uploadProductImage` / `deleteProductImage` em tempo real.
 */
export function ProductForm({
  initialData,
  categories,
  isDraft,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Guard síncrono contra duplo-clique: useTransition + disabled re-render
  // na velocidade do React não cobre o instante T0–T20ms entre 2 toques
  // rápidos no mobile. Ref síncrona resolve.
  const submittingRef = useRef(false);

  const [images, setImages] = useState<ProductImageData[]>(initialData.images);
  // Lista local que cresce quando uma nova categoria é criada via dialog
  // — Sandra cria + seleciona sem recarregar a página.
  const [localCategories, setLocalCategories] =
    useState<CategoryOption[]>(categories);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
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
      isActive: initialData.isActive,
      isFeatured: initialData.isFeatured,
      variants: initialData.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceInCents: v.priceInCents,
        stockQuantity: v.stockQuantity,
      })),
    },
  });

  // `submitMode` define o comportamento do submit ao clicar em qualquer
  // dos 2 botões. RHF dispara um único `handleSubmit`; lemos o modo
  // do estado pra decidir se reseta + redireciona pro próximo draft.
  const [submitMode, setSubmitMode] = useState<"save" | "saveAndContinue">(
    "save",
  );

  const onSubmit = (values: ProductFormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const payload = { productId: initialData.productId, ...values };

        if (submitMode === "save") {
          const result = await updateProduct(payload);
          if (!result.ok) {
            applyFieldErrors(result.fieldErrors);
            toast.error(result.error);
            return;
          }
          toast.success("Produto salvo.");
          router.refresh();
          return;
        }

        // saveAndContinue (só disponível pra draft — incrementa contador
        // só nesse caso, evita inflar número quando Sandra está editando
        // produto antigo).
        const result = await saveAndCreateNext(payload);
        if (!result.ok) {
          applyFieldErrors(result.fieldErrors);
          toast.error(result.error);
          return;
        }

        const count = bumpSessionCounter();
        toast.success(
          `Produto cadastrado. Pronto pro próximo. (${count} ${count === 1 ? "nesta série" : "nesta série"})`,
        );
        // `replace` em vez de `push` — evita acumular histórico de drafts.
        // Next 15 já scrolla pro topo no route change; sem scrollTo manual.
        router.replace(`/admin/produtos/${result.nextProductId}/editar`);
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

  // useCallback evita re-criar essas funções a cada keystroke do nome —
  // ImageUploader / VariantEditor não re-renderizam à toa.
  const handleImagesChange = useCallback((next: ProductImageData[]) => {
    setImages(next);
  }, []);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // Padding-bottom em mobile pra conteúdo não ficar atrás do sticky
      // save (1 botão ~3.5rem + py-3 + bottom nav 3.5rem + safe-area
      // ~1.25rem ≈ 9rem). Em desktop, sem sticky → padding mínimo.
      className="divide-border divide-y pb-36 lg:pb-4"
    >
      <FormSection
        title="Imagens"
        description="A primeira foto vira a capa. Tire pelo celular ou escolha da galeria."
      >
        <ImageUploader
          productId={initialData.productId}
          images={images}
          onChange={handleImagesChange}
          disabled={isPending}
        />
      </FormSection>

      <FormSection
        title="Identidade"
        description="O que aparece pros seus clientes."
      >
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
      </FormSection>

      <FormSection title="Preço">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-base-price">Preço normal</Label>
            <Controller
              name="basePriceInCents"
              control={control}
              render={({ field }) => (
                <PriceInput
                  id="product-base-price"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  disabled={isPending}
                  aria-invalid={!!errors.basePriceInCents}
                />
              )}
            />
            {errors.basePriceInCents?.message ? (
              <p className="text-destructive text-xs">
                {errors.basePriceInCents.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-promo-price">Preço promocional</Label>
            <Controller
              name="promoPriceInCents"
              control={control}
              render={({ field }) => (
                <PriceInput
                  id="product-promo-price"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Sem promoção"
                  disabled={isPending}
                  aria-invalid={!!errors.promoPriceInCents}
                />
              )}
            />
            {errors.promoPriceInCents?.message ? (
              <p className="text-destructive text-xs">
                {errors.promoPriceInCents.message}
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          A promoção fica ativa enquanto preenchida. Para parar, limpe o campo.
        </p>
      </FormSection>

      <FormSection title="Estoque">
        <Controller
          name="trackStock"
          control={control}
          render={({ field: trackField }) => (
            <Controller
              name="stockQuantity"
              control={control}
              render={({ field: qtyField }) => (
                <StockInput
                  value={{
                    trackStock: trackField.value,
                    stockQuantity: qtyField.value,
                  }}
                  onChange={(next) => {
                    trackField.onChange(next.trackStock);
                    qtyField.onChange(next.stockQuantity);
                  }}
                  disabled={isPending}
                />
              )}
            />
          )}
        />
        {errors.stockQuantity?.message ? (
          <p className="text-destructive text-xs">
            {errors.stockQuantity.message}
          </p>
        ) : null}
      </FormSection>

      <FormSection
        title="Categoria"
        description="Agrupa produtos na vitrine. Você pode criar uma agora se quiser."
      >
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
                const next: CategoryOption = {
                  id: c.id,
                  name: c.name,
                  parentId: c.parentId,
                };
                setLocalCategories((prev) => [...prev, next]);
                field.onChange(c.id); // auto-seleciona a recém-criada
              }}
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Variantes"
        description="Use quando o mesmo produto tem opções (P/M/G, cores, tamanhos)."
      >
        <Controller
          name="variants"
          control={control}
          render={({ field }) => (
            <VariantEditor
              value={field.value as VariantData[]}
              onChange={(next: VariantInput[]) => field.onChange(next)}
              disabled={isPending}
            />
          )}
        />
      </FormSection>

      {/* "Salvar e adicionar outro" inline (acima do sticky), só pra draft.
          Quando Sandra edita produto antigo, este botão não aparece —
          fluxo limpo: editar = Salvar, novo = Salvar OU continuar série. */}
      {isDraft ? (
        <div className="flex justify-center pt-4 lg:justify-end">
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || !isDirty}
            onClick={() => setSubmitMode("saveAndContinue")}
            className="w-full sm:w-auto sm:min-w-56"
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
        </div>
      ) : null}

      {/* Save desktop: inline no fim do form. */}
      <div className="hidden justify-end pt-4 lg:flex">
        <Button
          type="submit"
          disabled={isPending || !isDirty}
          onClick={() => setSubmitMode("save")}
          className="min-w-32"
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

      {/* Save mobile: sticky bottom, ACIMA do bottom nav. Compacto (1 botão)
          pra reduzir cromo. "+ adicionar outro" fica inline acima. */}
      <div
        className={cn(
          "surface-elevated fixed inset-x-0 z-50 px-4 py-3 lg:hidden",
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
        }}
      >
        <Button
          type="submit"
          disabled={isPending || !isDirty}
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

interface CategoryFieldProps {
  value: string | null;
  onChange: (next: string | null) => void;
  categories: CategoryOption[];
  disabled?: boolean;
  onCategoryCreated: (c: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }) => void;
}

const NO_CATEGORY = "__none__";

/**
 * Select de categoria + botão "+ Nova categoria" inline (abre `CategoryDialog`).
 * Quando Sandra cria via dialog, a nova categoria é injetada na lista local
 * e auto-selecionada — fluxo "criar e usar" sem recarregar a página.
 */
function CategoryField({
  value,
  onChange,
  categories,
  disabled,
  onCategoryCreated,
}: CategoryFieldProps) {
  // Recalcular roots/childrenByParent a cada keystroke do nome (RHF
  // re-renderiza o form inteiro) é cheap pra ~10 categorias mas trivial
  // memoizar.
  const { roots, childrenByParent } = useMemo(() => {
    const rootList = categories.filter((c) => c.parentId === null);
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return { roots: rootList, childrenByParent: map };
  }, [categories]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select
          value={value ?? NO_CATEGORY}
          onValueChange={(v) => onChange(v === NO_CATEGORY ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
            {roots.map((root) => {
              const children = childrenByParent.get(root.id) ?? [];
              if (children.length === 0) {
                return (
                  <SelectItem key={root.id} value={root.id}>
                    {root.name}
                  </SelectItem>
                );
              }
              return (
                <SelectGroup key={root.id}>
                  <SelectLabel>{root.name}</SelectLabel>
                  <SelectItem value={root.id}>{root.name} (geral)</SelectItem>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {root.name} › {child.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

        <CategoryDialog
          rootCategories={roots}
          onCreated={onCategoryCreated}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * Contador da sessão de cadastro contínuo. Vive em `sessionStorage` —
 * zera quando o lojista fecha a aba. Só roda no client (window check).
 */
const SESSION_COUNTER_KEY = "vitre:product-create-session-count";
function bumpSessionCounter(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = sessionStorage.getItem(SESSION_COUNTER_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = (Number.isNaN(current) ? 0 : current) + 1;
    sessionStorage.setItem(SESSION_COUNTER_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[14rem_1fr] lg:gap-8 lg:py-6">
      <header className="space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
