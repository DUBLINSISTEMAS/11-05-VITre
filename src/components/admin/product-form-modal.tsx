"use client";

// Modal de Produto — Bloco F (2026-05-29). Substitui ProductFormDrawer
// (Sheet side=right 1180px) por Dialog Radix fullscreen no MESMO ESTILO
// do new-sale-modal: 92vh/95vw, header com setinha esquerda + título +
// X direita, sem fechar por Esc ou click fora (anti-perda de edição).
//
// Decisão founder 2026-05-29: o drawer lateral parecia "desajustado, feio"
// e tirava a sensação de FOCO da edição/cadastro de produto. Modal fullscreen
// dá hierarquia visual igual à do PDV — operação importante = tela toda.
//
// O ProductForm interno (com 7 abas em sidebar vertical 180px + form) é
// reusado intacto via `embedded`. Footer (Arquivar/Cancelar/Salvar) vive
// aqui, igual ao do drawer antigo.

import {
  ArrowLeftIcon,
  ArchiveIcon,
  EyeIcon,
  Loader2Icon,
  PackageIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import { deleteProduct } from "@/actions/product/delete";
import {
  loadProductFormData,
  type ProductFormDrawerData,
} from "@/actions/product/load-form-data";
import { ProductForm } from "@/components/admin/product-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface ProductFormModalProps {
  /** UUID do produto pra editar, "new" pra modo novo, null pra fechado. */
  target: string | "new" | null;
  onOpenChange: (open: boolean) => void;
  /** Slug da loja — usado pelo botão "Ver loja". */
  storeSlug: string;
}

export function ProductFormModal({
  target,
  onOpenChange,
  storeSlug,
}: ProductFormModalProps) {
  const [data, setData] = useState<ProductFormDrawerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isLoading, startLoad] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
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
        logger.error("admin.product.modal_load_failed", { err, target });
        setError("Não foi possível carregar o produto.");
      }
    });
  }, [target]);

  const handleDelete = () => {
    if (!data || data.mode !== "edit") return;
    startDelete(async () => {
      const res = await deleteProduct({
        productId: data.initialData.productId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Produto arquivado.");
      setDeleteOpen(false);
      onOpenChange(false);
    });
  };

  const productName = data?.initialData.name?.trim() || null;
  const sku =
    data?.initialData.internalCode?.trim() ||
    (data?.mode === "new" ? "Novo produto" : null);

  return (
    <>
      <DialogPrimitive.Root
        open={target !== null}
        onOpenChange={onOpenChange}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
              "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
            )}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            /* Regras igual ao Nova Venda: anti-perda de progresso. Lojista
               não fecha por engano clicando fora ou batendo Esc com o
               teclado físico aberto. */
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              "bg-surface fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col outline-none",
              "h-dvh w-screen rounded-none",
              "lg:h-[92vh] lg:max-h-[920px] lg:w-[95vw] lg:max-w-[1400px] lg:rounded-[20px]",
              "lg:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25),0_4px_12px_-6px_rgba(0,0,0,0.1)]",
              "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            )}
          >
            {/* Header: voltar (esquerda) + título central + X (direita).
                Padrão de drawer secundário copiado do Nova Venda — fluxo
                visual igual pra lojista não estranhar. */}
            <header
              className={cn(
                "flex h-14 shrink-0 items-center justify-between gap-3",
                "border-line border-b px-3 sm:px-4",
              )}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Voltar"
                className={cn(
                  "text-ink-4 inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none",
                  "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/40",
                )}
              >
                <ArrowLeftIcon
                  className="size-4"
                  strokeWidth={1.6}
                  aria-hidden
                />
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                <div
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-[8px]"
                  style={{
                    background: "var(--mangos-yellow-soft)",
                    color: "var(--mangos-green-800)",
                  }}
                >
                  <PackageIcon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 text-center">
                  <DialogPrimitive.Title
                    className={cn(
                      "text-ink-1 text-[15px] font-semibold tracking-[-0.01em]",
                      "max-w-[60vw] truncate sm:max-w-none",
                    )}
                  >
                    {data?.mode === "new"
                      ? "Novo produto"
                      : productName
                        ? `Editar ${productName}`
                        : "Carregando produto…"}
                  </DialogPrimitive.Title>
                  {sku ? (
                    <p className="text-ink-4 font-mono text-[11px] leading-tight">
                      {sku}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
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
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Fechar"
                  className={cn(
                    "text-ink-4 inline-flex size-8 items-center justify-center rounded-md outline-none",
                    "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring/40",
                  )}
                >
                  <XIcon className="size-4" strokeWidth={1.6} aria-hidden />
                </button>
              </div>
            </header>

            {/* Body — scroll vertical interno. */}
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {isLoading || (!data && !error) ? (
                <ModalLoading />
              ) : error ? (
                <ModalError message={error} />
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
                  onSubmittingChange={setIsSaving}
                  onAfterSave={(opts) => {
                    if (opts.continueCreating) return; // segue no modal
                    onOpenChange(false);
                  }}
                />
              ) : null}
            </div>

            {/* Footer com ações — Arquivar (só edit) / Cancelar / Salvar. */}
            {data ? (
              <div className="border-line bg-surface flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-6">
                {data.mode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isDeleting}
                    className="b3-btn b3-btn--sm"
                    style={{ color: "var(--danger)" }}
                    aria-label="Arquivar produto"
                  >
                    {isDeleting ? (
                      <Loader2Icon
                        className="size-3.5 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <ArchiveIcon className="size-3.5" aria-hidden />
                    )}
                    Arquivar
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
                  disabled={isSaving}
                  className="b3-btn b3-btn--sm b3-btn--primary"
                >
                  {isSaving ? (
                    <Loader2Icon
                      className="size-3.5 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <SaveIcon className="size-3.5" aria-hidden />
                  )}
                  {isSaving
                    ? "Salvando…"
                    : data.mode === "new"
                      ? "Salvar produto"
                      : "Salvar"}
                </button>
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {productName
                ? `O produto "${productName}" sai do PDV, dos filtros ativos e da loja online.`
                : "Este rascunho fica pausado nos cadastros."}{" "}
              Histórico, estoque, fotos e movimentações continuam preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isDeleting ? "Arquivando..." : "Arquivar produto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ModalLoading() {
  return (
    <div className="text-ink-4 flex flex-1 items-center justify-center gap-2 py-12 text-sm">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Carregando…
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  return (
    <div className="border-danger/30 bg-danger/5 text-danger rounded-[10px] border p-4 text-[13px]">
      <p className="font-semibold">Não foi possível abrir o produto</p>
      <p className="mt-1 text-[12px] opacity-90">{message}</p>
    </div>
  );
}

// ============================================================================
// Listener global — montado em <AdminShell />, escuta OPEN_PRODUCT_FORM_EVENT
// e sincroniza com `?edit=<id|new>` na URL (preserva deep-link e back button).
// ============================================================================

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  OPEN_PRODUCT_FORM_EVENT,
  type OpenProductFormEventDetail,
} from "./product-form-events";

interface ProductFormModalListenerProps {
  storeSlug: string;
}

export function ProductFormModalListener({
  storeSlug,
}: ProductFormModalListenerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editFromUrl = searchParams.get("edit");

  const [target, setTarget] = useState<string | "new" | null>(editFromUrl);

  // Sync com URL — navegação ou link externo que vem com ?edit= mantém
  // o modal alinhado.
  useEffect(() => {
    setTarget(editFromUrl);
  }, [editFromUrl]);

  // Escuta evento global de abertura — atualiza URL pra refletir estado.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenProductFormEventDetail>;
      const id = ce.detail?.productId ?? null;
      const next = id ?? "new";
      setTarget(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("edit", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    window.addEventListener(OPEN_PRODUCT_FORM_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PRODUCT_FORM_EVENT, onOpen);
  }, [pathname, router, searchParams]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setTarget(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("edit");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
          scroll: false,
        });
        router.refresh();
      }
    },
    [pathname, router, searchParams],
  );

  return (
    <ProductFormModal
      target={target}
      onOpenChange={handleOpenChange}
      storeSlug={storeSlug}
    />
  );
}
