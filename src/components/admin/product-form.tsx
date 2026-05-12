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
import { Switch } from "@/components/ui/switch";
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
  /** Meta-fields canvas-v1 — null quando lojista não preencheu. */
  composition: string | null;
  modeling: string | null;
  lining: string | null;
  washing: string | null;
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
   * faz sentido pra produto novo.
   */
  isDraft: boolean;
  /**
   * Callback chamado após save bem-sucedido. Quando fornecido, o form NÃO
   * navega via router — o pai decide (Onda 5: ProductDialog usa pra fechar
   * modal ou trocar pro próximo draft).
   * - `nextProductId` vem preenchido quando o usuário clicou "Salvar e
   *   adicionar outro" — pai deve trocar o productId do form pra esse.
   * - Quando ausente, foi save comum.
   * Sem callback fornecido, mantém comportamento legado (router.refresh /
   * router.replace pra /editar).
   */
  onAfterSave?: (opts: { nextProductId?: string; continueCreating?: boolean }) => void;
  /**
   * Cria produto sob demanda no fluxo de novo produto. A função recebe valores
   * válidos do form e deve persistir produto + variantes em uma única ação.
   */
  onCreateProduct?: (
    values: ProductFormValues,
  ) => Promise<{ ok: true; productId: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }>;
  /**
   * Indica que o form vive dentro de um Dialog. Ajusta sticky save mobile
   * pra ficar no fim do conteúdo do dialog em vez de fixed na viewport.
   */
  inDialog?: boolean;
}

/**
 * Form de edição/criação de produto (canvas-v1 admin Lote 3).
 *
 * Layout:
 * - Mobile: cards empilhados verticalmente em `space-y-4`.
 * - Desktop (lg+): grid 3 colunas. Esquerda (col-span-2): Mídia ·
 *   Identidade · Detalhes · Preço · Variantes. Direita (col-span-1,
 *   sticky top): Status · Categoria · Salvar.
 *
 * `isActive` continua FORA do form — toggle no header da página via action
 * separada (publish/pause). `images` fora do RHF — gerenciadas em state
 * local + actions de upload/delete em tempo real. Lógica de submit (RHF +
 * Proteção contra duplo submit por ref síncrona, além de useTransition.
 * preservada do estado anterior.
 */
export function ProductForm({
  initialData,
  categories,
  isDraft,
  onAfterSave,
  onCreateProduct,
  inDialog = false,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const [images, setImages] = useState<ProductImageData[]>(initialData.images);
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
      composition: initialData.composition ?? "",
      modeling: initialData.modeling ?? "",
      lining: initialData.lining ?? "",
      washing: initialData.washing ?? "",
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

        if (submitMode === "save") {
          toast.success("Produto salvo.");
          if (onAfterSave) {
            onAfterSave({});
          } else {
            router.refresh();
          }
          return;
        }

        const count = bumpSessionCounter();
        toast.success(
          `Produto cadastrado. Pronto pro próximo. (${count} ${count === 1 ? "nesta série" : "nesta série"})`,
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

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // Padding-bottom em mobile pra conteúdo não ficar atrás do sticky
      // save (1 botão ~3.5rem + py-3 + bottom nav 3.5rem + safe-area
      // ~1.25rem ≈ 9rem). No dialog, o sticky bottom já cuida disso.
      className="mx-auto max-w-[1360px] pb-20 lg:pb-4"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* === Coluna esquerda (lg col-span-2) === */}
        <div className="space-y-4">
          <FormCard
            title="Mídia"
            description={
              onCreateProduct
                ? "Salve o produto primeiro para liberar o envio de fotos."
                : "A primeira foto vira a capa. Tire pelo celular ou escolha da galeria."
            }
          >
            <ImageUploader
              productId={initialData.productId}
              images={images}
              onChange={handleImagesChange}
              disabled={isPending || !!onCreateProduct}
            />
          </FormCard>

          <FormCard title="Identidade">
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
          </FormCard>

          <FormCard
            title="Detalhes"
            description="Aparecem na ficha do produto. Tudo opcional."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaField
                id="product-composition"
                label="Composição"
                placeholder="Ex: 100% linho"
                error={errors.composition?.message}
                disabled={isPending}
                {...register("composition")}
              />
              <MetaField
                id="product-modeling"
                label="Modelagem"
                placeholder="Ex: Evasê midi"
                error={errors.modeling?.message}
                disabled={isPending}
                {...register("modeling")}
              />
              <MetaField
                id="product-lining"
                label="Forro"
                placeholder="Ex: Não possui"
                error={errors.lining?.message}
                disabled={isPending}
                {...register("lining")}
              />
              <MetaField
                id="product-washing"
                label="Lavagem"
                placeholder="Ex: À mão"
                error={errors.washing?.message}
                disabled={isPending}
                {...register("washing")}
              />
            </div>
          </FormCard>

          <FormCard title="Preço">
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
          </FormCard>

          <FormCard
            title="Variantes"
            description="Use quando o mesmo produto tem opções (P/M/G, cores)."
          >
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
          </FormCard>
        </div>

        {/* === Coluna direita (lg col-span-1, sticky) === */}
        <div className="space-y-4 lg:sticky lg:top-5">
          <FormCard title="Status">
            <Controller
              name="isFeatured"
              control={control}
              render={({ field }) => (
                <ToggleRow
                  id="product-featured"
                  label="Em destaque"
                  description="Aparece em primeiro na vitrine."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
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
          </FormCard>

          <FormCard
            title="Organização"
            description="Categoria que agrupa esse produto na vitrine."
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
                    field.onChange(c.id);
                  }}
                />
              )}
            />
          </FormCard>

          {/* Save desktop: dentro da coluna direita pra ficar sticky junto. */}
          <div className="hidden flex-col gap-2 lg:flex">
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
            {isDraft ? (
              <Button
                type="submit"
                variant="outline"
                disabled={isPending || !isDirty}
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
      </div>

      {/* Save mobile: sticky bottom acima do bottom nav. "+ adicionar outro"
          inline acima quando draft. */}
      {isDraft ? (
        <div className="flex justify-center pt-4 lg:hidden">
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || !isDirty}
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
        </div>
      ) : null}

      {/* Save mobile — dentro de Dialog vira sticky relativo ao container;
          fora, fixed na viewport acima do bottom nav. */}
      <div
        className={cn(
          "surface-elevated z-50 px-3 py-3 lg:hidden sm:px-4",
          inDialog
            ? "sticky bottom-0 -mx-3 mt-4 border-t bg-card/95 backdrop-blur sm:-mx-5"
            : "fixed inset-x-0",
        )}
        style={
          inDialog
            ? undefined
            : {
                bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
              }
        }
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

// ===========================================================================
// FormCard (canvas-v1 admin Lote 3) — substitui FormSection grid 14rem.
// Card individual com border + padding + título no topo.
// ===========================================================================

interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormCard({ title, description, children }: FormCardProps) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:p-5 xl:p-6">
      <header className="space-y-0.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-[11.5px] leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ===========================================================================
// MetaField — input compacto pros 4 campos meta canvas. Reduz repetição.
// ===========================================================================

interface MetaFieldProps extends React.ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: string;
}

const MetaField = ({
  id,
  label,
  error,
  className,
  ...inputProps
}: MetaFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      maxLength={120}
      autoComplete="off"
      aria-invalid={!!error}
      className={className}
      {...inputProps}
    />
    {error ? <p className="text-destructive text-xs">{error}</p> : null}
  </div>
);

// ===========================================================================
// ToggleRow — linha de switch com label + descrição (card Status canvas).
// ===========================================================================

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id} className="text-[12.5px] font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-muted-foreground text-[11px] leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ===========================================================================
// CategoryField — Select + botão "+ Nova categoria" inline.
// ===========================================================================

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

function CategoryField({
  value,
  onChange,
  categories,
  disabled,
  onCategoryCreated,
}: CategoryFieldProps) {
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

// ===========================================================================
// Sessão de cadastro contínuo (sessionStorage).
// ===========================================================================

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
