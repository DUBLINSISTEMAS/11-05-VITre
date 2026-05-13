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
import { uploadProductImage } from "@/actions/product/upload-image";
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

import {
  CategoryDialog,
  type CategoryOption,
} from "./category-dialog";
import {
  ImageUploader,
  type ProductImageData,
  type StagedImageFile,
} from "./image-uploader";
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
   * Callback chamado após save bem-sucedido. O pai decide pra onde ir.
   * - `continueCreating` true → usuário clicou "Salvar e adicionar outro".
   *   Pai deve remontar o form vazio (ex: bump key).
   * - Sem flag → save comum. Pai navega ou refresh conforme contexto
   *   (página /novo → push pra lista; página /[id] → refresh).
   */
  onAfterSave?: (opts: { continueCreating?: boolean }) => void;
  /**
   * Cria produto sob demanda no fluxo de novo produto. A função recebe valores
   * válidos do form e deve persistir produto + variantes em uma única ação.
   */
  onCreateProduct?: (
    values: ProductFormValues,
  ) => Promise<{ ok: true; productId: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }>;
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
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const [images, setImages] = useState<ProductImageData[]>(initialData.images);
  const [localCategories, setLocalCategories] =
    useState<CategoryOption[]>(categories);
  // Fluxo staged (padrão Shopify/Nuvem Shop): em criação, fotos ficam em
  // memória do client. Após createProductFromValues retornar productId,
  // ProductForm faz upload em paralelo via flushStagedFiles.
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

        // ============================================================
        // STAGED FLUSH — só em criação, após produto persistido.
        // Sobe fotos em PARALELO usando productId real. Falhas parciais
        // não bloqueiam o sucesso do produto; toast comunica o que rolou.
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

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // Padding-bottom em mobile pra conteúdo não ficar atrás do sticky
      // save (1 botão ~3.5rem + py-3 + bottom nav 3.5rem + safe-area
      // ~1.25rem ≈ 9rem).
      className="mx-auto max-w-[1360px] pb-36 lg:pb-4"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* === Coluna esquerda (lg col-span-2) === */}
        <div className="space-y-4">
          <FormCard
            title="Mídia"
            description="A primeira foto vira a capa. Tire pelo celular ou escolha da galeria."
          >
            <ImageUploader
              productId={initialData.productId}
              images={images}
              onChange={handleImagesChange}
              mode={isCreating ? "staged" : "server"}
              stagedFiles={stagedFiles}
              onStagedChange={setStagedFiles}
              disabled={isPending}
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
            {/*
              Em criação (`isDraft`), o switch isActive entra no form via Controller —
              produto salva já visível na vitrine por default (padrão Shopify).
              Em edição o instant-toggle vive no header (<ProductPublishToggle/>)
              pra publicar/pausar sem reabrir o form inteiro, então ocultamos
              aqui pra não duplicar controle nem confundir lojista.
            */}
            {isDraft ? (
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <ToggleRow
                    id="product-active"
                    label="Visível na loja"
                    description="Se desligado, o produto fica como rascunho — só você vê."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
            ) : null}

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
      </div>

      {/*
        Save mobile sticky — fixed na viewport, acima do admin bottom nav.
        Em criação (isDraft), empilha "Salvar e adicionar outro" acima do
        "Salvar" pra fluxo Shopify sem duplicar botão (auditoria K3).
      */}
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
