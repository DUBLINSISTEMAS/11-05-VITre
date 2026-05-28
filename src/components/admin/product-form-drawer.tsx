"use client";

// Drawer de produto — handoff PP1 Fase B (2026-05-25).
//
// Sheet slide-right 760px envolvendo o ProductForm (já refator 6 abas
// na Fase A). Header com avatar + nome + SKU + "Ver loja" btn. Footer
// custom com Excluir/Cancelar/Salvar/Publicar (o sticky bar interno
// do ProductForm é escondido via prop `embedded`).
//
// Carregamento sob demanda: ao abrir, chama loadProductFormData(productId)
// e mostra spinner. null = modo "novo" (form vazio, ProductForm cria via
// createProductFromValues).
//
// Controlado por `productId | "new" | null` (null = fechado). O host
// (ProductFormDrawerListener) é quem segura o state e roda em admin-shell.

import {
  EyeIcon,
  Loader2Icon,
  PackageIcon,
  SaveIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import { deleteProduct } from "@/actions/product/delete";
import {
  loadProductFormData,
  type ProductFormDrawerData,
} from "@/actions/product/load-form-data";
import { ProductForm } from "@/components/admin/product-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { logger } from "@/lib/logger";

interface ProductFormDrawerProps {
  /** UUID do produto pra editar, "new" pra modo novo, null pra fechado. */
  target: string | "new" | null;
  onOpenChange: (open: boolean) => void;
  /** Slug da loja — usado pelo botão "Ver loja". */
  storeSlug: string;
}

export function ProductFormDrawer({
  target,
  onOpenChange,
  storeSlug,
}: ProductFormDrawerProps) {
  const [data, setData] = useState<ProductFormDrawerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const submitRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (target === null) {
      setData(null);
      setError(null);
      return;
    }
    setData(null);
    setError(null);
    startLoad(async () => {
      try {
        const productId = target === "new" ? null : target;
        const res = await loadProductFormData(productId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setData(res.data);
      } catch (err) {
        logger.error("admin.product.drawer_load_failed", { err, target });
        setError("Não foi possível carregar o produto.");
      }
    });
  }, [target]);

  const handleDelete = () => {
    if (!data || data.mode !== "edit") return;
    const productName = data.initialData.name || "este rascunho";
    if (
      !confirm(
        `Excluir "${productName}"? Vendas e movimentações ficam preservadas.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
      const res = await deleteProduct({ productId: data.initialData.productId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Produto excluído.");
      onOpenChange(false);
    });
  };

  const productName = data?.initialData.name?.trim() || null;
  const sku =
    data?.initialData.internalCode?.trim() ||
    (data?.mode === "new" ? "Novo produto" : null);

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]"
      >
        {/* Header — avatar yellow-soft + nome + SKU + "Ver loja" + close. */}
        <SheetHeader className="border-line shrink-0 gap-0 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-[10px]"
              style={{
                background: "var(--mangos-yellow-soft)",
                color: "var(--mangos-green-800)",
              }}
            >
              <PackageIcon className="size-4.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-ink-1 text-[15px] font-semibold tracking-tight">
                {data?.mode === "new"
                  ? "Novo produto"
                  : productName
                    ? `Editar ${productName}`
                    : "Carregando produto…"}
              </SheetTitle>
              <SheetDescription asChild>
                <p className="text-ink-4 font-mono text-[11.5px]">
                  {sku ?? "—"}
                </p>
              </SheetDescription>
            </div>
            {data?.mode === "edit" && productName ? (
              <Link
                href={`/${storeSlug}/produto/${data.initialData.productId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="b3-btn b3-btn--sm hidden sm:inline-flex"
                aria-label="Ver produto na loja online"
                title="Ver na loja online (nova aba)"
              >
                <EyeIcon size={13} aria-hidden /> Ver na loja
              </Link>
            ) : null}
          </div>
        </SheetHeader>

        {/* Body — scroll vertical interno. */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || (!data && !error) ? (
            <DrawerLoading />
          ) : error ? (
            <DrawerError message={error} />
          ) : data ? (
            <ProductForm
              key={data.initialData.productId}
              embedded
              submitRef={submitRef}
              initialData={data.initialData}
              categories={data.categories}
              brands={data.brands}
              storeNiche={data.storeNiche ?? undefined}
              storeFees={data.storeFees}
              isDraft={data.isDraft}
              onCreateProduct={
                data.mode === "new" ? createProductFromValues : undefined
              }
              onAfterSave={(opts) => {
                if (opts.continueCreating) return; // segue no drawer
                onOpenChange(false);
              }}
            />
          ) : null}
        </div>

        {/* Footer com ações — Excluir (só edit) / Cancelar / Salvar. */}
        {data ? (
          <div className="border-line bg-surface shrink-0 flex flex-wrap items-center gap-2 border-t p-4">
            {data.mode === "edit" ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="b3-btn b3-btn--sm"
                style={{ color: "var(--danger)" }}
                aria-label="Excluir produto"
              >
                {isDeleting ? (
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <TrashIcon className="size-3.5" aria-hidden />
                )}
                Excluir
              </button>
            ) : null}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="b3-btn b3-btn--sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => submitRef.current?.click()}
              className="b3-btn b3-btn--sm b3-btn--primary"
            >
              <SaveIcon className="size-3.5" aria-hidden />
              {data.mode === "new" ? "Publicar produto" : "Salvar"}
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerLoading() {
  return (
    <div className="text-ink-4 flex flex-1 items-center justify-center gap-2 py-12 text-sm">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Carregando…
    </div>
  );
}

function DrawerError({ message }: { message: string }) {
  return (
    <div className="border-danger/30 bg-danger/5 rounded-[10px] border p-4 text-[13px] text-danger">
      <p className="font-semibold">Não foi possível abrir o produto</p>
      <p className="mt-1 text-[12px] opacity-90">{message}</p>
    </div>
  );
}
