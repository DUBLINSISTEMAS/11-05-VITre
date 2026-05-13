"use client";

/**
 * ProductDialog - modal de criação/edição de produto.
 *
 * Edição carrega produto existente. Criação abre instantaneamente com dados
 * vazios e só cria draft no primeiro save, evitando rascunhos fantasmas.
 */
import { Loader2Icon } from "lucide-react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import {
  loadProductDetail,
  type ProductDetail,
} from "@/actions/product/load-detail";
import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { ProductForm } from "@/components/admin/product-form";
import { ProductPublishToggle } from "@/components/admin/product-publish-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProductDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; productId: string };

interface ProductDialogProps {
  state: ProductDialogState;
  onClose: () => void;
  /**
   * Categorias pré-fetchadas no SSR pelo page.tsx. Em modo `create`,
   * o modal abre instantâneo sem chamar loadProductFormOptions.
   * Em modo `edit`, loadProductDetail traz categorias fresh junto
   * com o produto, então essa prop é apenas fallback inicial.
   */
  initialCategories: CategoryOption[];
}

/**
 * Prefixo do id efêmero pra produto-novo (não persistido). Cada abertura
 * de "criar produto" — incluindo o reset após "salvar e adicionar outro"
 * — gera `new-${nanoid()}`. Mudar a cada reset garante que a `key` do
 * <ProductForm /> mude e o RHF resete defaultValues.
 */
const NEW_PRODUCT_PREFIX = "new-";
const isNewProductId = (id: string) => id.startsWith(NEW_PRODUCT_PREFIX);
const generateNewProductId = () => `${NEW_PRODUCT_PREFIX}${nanoid(8)}`;

export function ProductDialog({
  state,
  onClose,
  initialCategories,
}: ProductDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh em background pra não bloquear o close do modal. Sem isso,
  // após "Salvar" o router.refresh() (~80–500ms RSC roundtrip) deixava
  // o modal "preso" antes de fechar.
  const scheduleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Primitivos derivados pra dep array — usar `[state]` (objeto) refazia
  // `loadProductDetail` a cada `router.refresh()` (mesmo `mode`/`productId`,
  // referência nova). Crítico C3 da auditoria 2026-05-12.
  const stateMode = state.mode;
  const stateProductId = state.mode === "edit" ? state.productId : null;

  useEffect(() => {
    if (stateMode === "closed") {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setData(null);
    setError(null);

    if (stateMode === "create") {
      // Modal abre instantâneo — categorias já vieram via prop SSR.
      // Sem fetch, sem spinner, form vazio renderiza no mesmo frame.
      setData(createEmptyProduct(null, initialCategories));
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    // stateMode === "edit" — stateProductId é garantidamente string aqui.
    if (!stateProductId) return;
    setLoading(true);

    void (async () => {
      try {
        const res = await loadProductDetail(stateProductId);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setData(res.product);
      } catch (e) {
        if (cancelled) return;
        console.error("product_dialog.load_failed", e);
        setError("Falha ao abrir o produto. Tente novamente.");
        toast.error("Falha ao abrir o produto. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Categorias do SSR não devem refazer o effect quando o pai re-render;
    // são estáveis na sessão (e re-fetch no edit traz versão fresca).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateMode, stateProductId]);

  const isOpen = state.mode !== "closed";
  const product = data;

  const reloadProduct = async (productId: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await loadProductDetail(productId);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setData(res.product);
    } catch (e) {
      console.error("product_dialog.reload_failed", e);
      setError("Falha ao carregar o próximo produto.");
      toast.error("Falha ao carregar o próximo produto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/*
        IMPORTANTE: `sm:max-w-[1600px]` é obrigatório.
        `DialogContent` base aplica `sm:max-w-lg` (32rem) que vence em
        qualquer viewport ≥640px porque `twMerge` não conflita base
        com variantes (`max-w-` vs `sm:max-w-` são utilities diferentes).
        Sem o `sm:` aqui o modal fica preso em ~512px no desktop inteiro.
      */}
      <DialogContent className="flex h-[96dvh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden border-white/10 p-0 shadow-2xl sm:max-w-[1600px] sm:rounded-3xl lg:h-[92dvh] lg:w-[min(1500px,calc(100vw-3rem))] xl:w-[min(1540px,94vw)]">
        {loading || (state.mode === "edit" && !data && !error) ? (
          <DialogLoading />
        ) : error ? (
          <DialogError message={error} />
        ) : product ? (
          <DialogReady
            product={product}
            onCreateProduct={state.mode === "create" ? createProductFromValues : undefined}
            onAfterSave={(opts) => {
              if (opts.continueCreating) {
                setData((current) =>
                  current ? createEmptyProduct(null, current.categories) : current,
                );
                scheduleRefresh();
                return;
              }
              if (opts.nextProductId) {
                void reloadProduct(opts.nextProductId);
                scheduleRefresh();
                return;
              }
              onClose();
              scheduleRefresh();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function createEmptyProduct(
  productId: string | null,
  categories: ProductDetail["categories"],
): ProductDetail {
  return {
    // Id efêmero `new-${nanoid()}` muda a cada chamada — força <ProductForm>
    // a resetar quando o pai chama createEmptyProduct novamente após
    // "salvar e adicionar outro" (key={product.id} no DialogReady).
    id: productId ?? generateNewProductId(),
    name: "",
    description: "",
    basePriceInCents: 0,
    promoPriceInCents: null,
    promoStartsAt: null,
    promoEndsAt: null,
    categoryId: null,
    trackStock: false,
    stockQuantity: null,
    // Default Shopify/Nuvem Shop: produto salvo aparece na vitrine.
    // Lojista que quer rascunho desliga o toggle "Visível na loja"
    // dentro do card Status antes de salvar.
    isActive: true,
    isFeatured: false,
    composition: null,
    modeling: null,
    lining: null,
    washing: null,
    // Slug placeholder estável só pra TypeScript; nunca persiste —
    // generateUniqueProductSlug é chamado no insert.
    slug: "",
    images: [],
    variants: [],
    categories,
  };
}

function DialogLoading() {
  return (
    <>
      <DialogHeader className="border-b px-5 py-4 sm:px-6">
        <DialogTitle className="sr-only">Carregando produto...</DialogTitle>
        <DialogDescription className="sr-only">
          Aguardando dados do produto.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando...
      </div>
    </>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <>
      <DialogHeader className="border-b px-5 py-4 sm:px-6">
        <DialogTitle>Não foi possível abrir o produto</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
      </DialogHeader>
    </>
  );
}

function DialogReady({
  product,
  onCreateProduct,
  onAfterSave,
}: {
  product: ProductDetail;
  onCreateProduct?: ComponentProps<typeof ProductForm>["onCreateProduct"];
  onAfterSave: (opts: { nextProductId?: string; continueCreating?: boolean }) => void;
}) {
  // Em criação o id começa com "new-" (efêmero). Em edição o id é UUID real.
  const persisted = !isNewProductId(product.id);
  const isDraft = !persisted;
  const headerTitle = isDraft ? "Novo produto" : product.name;

  return (
    <>
      <DialogHeader className="sticky top-0 z-10 flex flex-row items-center gap-3 border-b bg-card/95 px-5 py-3 backdrop-blur sm:px-6 lg:px-8 lg:py-5">
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-base font-semibold sm:text-lg lg:text-xl">
            {headerTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isDraft
              ? "Preencha nome e preço. O produto só vira rascunho ao salvar."
              : "Edite os dados e clique em Salvar."}
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1 pr-7">
          {persisted ? (
            <>
              <ProductPublishToggle
                productId={product.id}
                isActive={product.isActive}
                disabled={isDraft}
              />
              <ProductActionsMenu
                productId={product.id}
                productName={product.name}
              />
            </>
          ) : null}
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5 lg:px-8 lg:py-6 xl:px-10">
        <ProductForm
          key={product.id}
          isDraft={isDraft}
          categories={product.categories}
          onCreateProduct={onCreateProduct}
          onAfterSave={onAfterSave}
          inDialog
          initialData={{
            productId: product.id,
            name: product.name,
            description: product.description,
            basePriceInCents: product.basePriceInCents,
            promoPriceInCents: product.promoPriceInCents,
            categoryId: product.categoryId,
            trackStock: product.trackStock,
            stockQuantity: product.stockQuantity,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            composition: product.composition,
            modeling: product.modeling,
            lining: product.lining,
            washing: product.washing,
            variants: product.variants,
            images: product.images,
          }}
        />
      </div>
    </>
  );
}
