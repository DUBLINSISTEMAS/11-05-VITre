"use client";

/**
 * ProductDialog - modal de criação/edição de produto.
 *
 * Cria/carrega o produto sob demanda e nunca deixa o dialog preso em loading:
 * falhas inesperadas das server actions viram estado de erro renderizável.
 */
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createDraftProduct } from "@/actions/product/create-draft";
import {
  loadProductDetail,
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
    setLoading(true);

    void (async () => {
      try {
        const productId =
          state.mode === "edit" ? state.productId : await ensureDraftId();
        if (cancelled) return;
        if (!productId) return;

        const res = await loadProductDetail(productId);
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

    async function ensureDraftId(): Promise<string | null> {
      const draft = await createDraftProduct();
      if (cancelled) return null;
      if (!draft.ok) {
        setError(draft.error);
        toast.error(draft.error);
        return null;
      }
      return draft.productId;
    }

    return () => {
      cancelled = true;
    };
  }, [state]);

  const isOpen = state.mode !== "closed";

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
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        {loading || (!data && !error) ? (
          <DialogLoading />
        ) : error ? (
          <DialogError message={error} />
        ) : data ? (
          <DialogReady
            product={data}
            onAfterSave={(opts) => {
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
  onAfterSave,
}: {
  product: ProductDetail;
  onAfterSave: (opts: { nextProductId?: string }) => void;
}) {
  const isDraft = !product.name.trim() || product.slug.startsWith("draft-");
  const headerTitle = isDraft ? "Novo produto" : product.name;

  return (
    <>
      <DialogHeader className="sticky top-0 z-10 flex flex-row items-center gap-3 border-b bg-card/95 px-5 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-base font-semibold sm:text-lg">
            {headerTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isDraft
              ? "Rascunho - preencha nome e preço, depois marque Visível."
              : "Edite os dados e clique em Salvar."}
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1 pr-7">
          <ProductPublishToggle
            productId={product.id}
            isActive={product.isActive}
            disabled={isDraft}
          />
          <ProductActionsMenu
            productId={product.id}
            productName={product.name}
          />
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-5">
        <ProductForm
          key={product.id}
          isDraft={isDraft}
          categories={product.categories}
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
