"use client";

/**
 * ProductDialog - modal de criação/edição de produto.
 *
 * Edição carrega produto existente. Criação abre instantaneamente com dados
 * vazios e só cria draft no primeiro save, evitando rascunhos fantasmas.
 */
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import {
  loadProductDetail,
  loadProductFormOptions,
  type ProductDetail,
} from "@/actions/product/load-detail";
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
}

const NEW_PRODUCT_ID = "new-product";

export function ProductDialog({ state, onClose }: ProductDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.mode === "closed") {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setData(null);
    setError(null);

    if (state.mode === "create") {
      setLoading(true);
      void (async () => {
        try {
          const options = await loadProductFormOptions();
          if (cancelled) return;
          if (!options.ok) {
            setError(options.error);
            return;
          }
          setData(createEmptyProduct(null, options.categories));
        } catch (e) {
          if (cancelled) return;
          console.error("product_dialog.options_failed", e);
          setError("Falha ao abrir o cadastro. Tente novamente.");
          toast.error("Falha ao abrir o cadastro. Tente novamente.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    void (async () => {
      try {
        const res = await loadProductDetail(state.productId);
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
  }, [state]);

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
      <DialogContent className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-2xl sm:!inset-auto sm:!top-[50%] sm:!left-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:h-[90dvh] sm:max-h-[900px] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:rounded-2xl sm:border md:max-w-5xl lg:h-[92dvh] lg:max-h-[1000px] lg:max-w-6xl xl:max-w-7xl">
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
                router.refresh();
                return;
              }
              if (opts.nextProductId) {
                void reloadProduct(opts.nextProductId);
                router.refresh();
                return;
              }
              onClose();
              router.refresh();
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
    id: productId ?? NEW_PRODUCT_ID,
    name: "",
    description: "",
    basePriceInCents: 0,
    promoPriceInCents: null,
    promoStartsAt: null,
    promoEndsAt: null,
    categoryId: null,
    trackStock: false,
    stockQuantity: null,
    isActive: false,
    isFeatured: false,
    composition: null,
    modeling: null,
    lining: null,
    washing: null,
    slug: "draft-new-product",
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
  const isDraft = !product.name.trim() || product.slug.startsWith("draft-");
  const headerTitle = isDraft ? "Novo produto" : product.name;
  const persisted = product.id !== NEW_PRODUCT_ID;

  return (
    <>
      <DialogHeader className="sticky top-0 z-10 flex shrink-0 flex-row items-center gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur sm:gap-3 sm:px-6 lg:px-8 lg:py-4">
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-sm font-semibold sm:text-base lg:text-lg">
            {headerTitle}
          </DialogTitle>
          <DialogDescription className="hidden text-xs sm:block">
            {isDraft
              ? "Preencha nome e preço. O produto só vira rascunho ao salvar."
              : "Edite os dados e clique em Salvar."}
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1 pr-8 sm:pr-6">
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

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-muted/20 px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
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
