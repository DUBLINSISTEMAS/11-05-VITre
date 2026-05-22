"use client";

/**
 * Redesign PDV — ProductPickerDialog.
 *
 * Dialog modal que substitui o picker inline da coluna esquerda do
 * pdv-shell. Lojista clica "+ Adicionar produto", aqui escolhe N itens
 * por busca/categoria, marca os que quer, clica "Adicionar N" e os
 * itens entram no carrinho.
 *
 * Densidade adaptativa: grid 2/3/4/5 cols por viewport, cards 120px
 * com thumb 56px. Produtos com variantes expandem inline (cada variante
 * tem checkbox próprio — lojista marca tamanhos/cores específicos).
 *
 * Performance: busca debounced 200ms; load inicial = "produtos mais
 * recentes" (sem filtro); categorias preloaded em paralelo ao abrir.
 *
 * Fluxo:
 *   1. Dialog abre → preload categorias (cards) + 24 produtos recentes
 *   2. Lojista digita busca OU clica chip categoria → refetch
 *   3. Marca produtos (qty=1 default — ajusta no carrinho depois)
 *   4. Click "Adicionar N selecionados" → onAdd(items) + fecha
 */

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  PackageIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadCategoriesForPdv,
  type PdvCategoryHit,
} from "@/actions/category/load-for-pdv";
import {
  type PdvProductHit,
  type PdvProductVariantHit,
  searchProductsForPdv,
} from "@/actions/product/search-for-pdv";
import { formatBRL, resolveVariantPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Item selecionado no picker — vira CartItem no shell ao confirmar. */
export interface PickerSelection {
  product: PdvProductHit;
  variant: PdvProductVariantHit | null;
  effectivePrice: number;
}

interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando lojista confirma — recebe itens marcados, qty=1 cada. */
  onAdd: (items: PickerSelection[]) => void;
}

/** Calcula preço efetivo de produto (considera promo + janela). Espelha
 *  resolveVariantPrice usado server-side. */
function getEffectivePrice(p: PdvProductHit): number {
  return resolveVariantPrice(
    null,
    {
      basePriceInCents: p.basePriceInCents,
      promoPriceInCents: p.promoPriceInCents,
      promoStartsAt: p.promoStartsAt,
      promoEndsAt: p.promoEndsAt,
    },
    new Date(),
  );
}

function getVariantPrice(p: PdvProductHit, v: PdvProductVariantHit): number {
  return resolveVariantPrice(
    { priceInCents: v.priceInCents, promoPriceInCents: null },
    {
      basePriceInCents: p.basePriceInCents,
      promoPriceInCents: p.promoPriceInCents,
      promoStartsAt: p.promoStartsAt,
      promoEndsAt: p.promoEndsAt,
    },
    new Date(),
  );
}

function selectionKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function ProductPickerDialog({
  open,
  onOpenChange,
  onAdd,
}: ProductPickerDialogProps) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [hits, setHits] = useState<PdvProductHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<PdvCategoryHit[]>([]);
  const [selected, setSelected] = useState<Map<string, PickerSelection>>(
    new Map(),
  );
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(
    new Set(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload categorias quando dialog abre (uma única vez por abertura).
  useEffect(() => {
    if (!open) return;
    void loadCategoriesForPdv().then(setCategories);
  }, [open]);

  // Reset ao fechar — próxima abertura começa limpo.
  useEffect(() => {
    if (open) return;
    setQ("");
    setCategoryId(null);
    setHits([]);
    setSelected(new Map());
    setExpandedVariants(new Set());
  }, [open]);

  // Busca com debounce — também roda quando categoria muda.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsSearching(true);
      void searchProductsForPdv(q, { categoryId }).then((results) => {
        setHits(results);
        setIsSearching(false);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, categoryId, open]);

  const totalProductCount = useMemo(
    () => categories.reduce((acc, c) => acc + c.productCount, 0),
    [categories],
  );

  const toggleSelection = useCallback(
    (product: PdvProductHit, variant: PdvProductVariantHit | null) => {
      setSelected((prev) => {
        const key = selectionKey(product.id, variant?.id ?? null);
        const next = new Map(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          const effectivePrice = variant
            ? getVariantPrice(product, variant)
            : getEffectivePrice(product);
          next.set(key, { product, variant, effectivePrice });
        }
        return next;
      });
    },
    [],
  );

  const toggleVariants = useCallback((productId: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected.size === 0) return;
    onAdd(Array.from(selected.values()));
    onOpenChange(false);
  }, [selected, onAdd, onOpenChange]);

  const selectedCount = selected.size;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay sutil — sem blur (o modal pai já desfoca o admin atrás).
            Apenas um dim leve pra destacar o picker do venda modal embaixo. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/30",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />

        {/* Modal — mesmo estilo do new-sale-modal, mas menor:
            ~1000×720 em desktop, fullscreen em mobile. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "bg-surface fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col outline-none",
            "h-dvh w-screen rounded-none",
            "lg:h-[85vh] lg:max-h-[720px] lg:w-[92vw] lg:max-w-[1000px] lg:rounded-[20px]",
            "lg:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25),0_4px_12px_-6px_rgba(0,0,0,0.1)]",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          {/* ── Header 56px: voltar / título centralizado / fechar.
              Mesmo padrão do new-sale-modal — ícones size-4, strokeWidth 1.6,
              ink-4 (cinza claro) com hover ink-2. */}
          <header
            className={cn(
              "flex h-14 shrink-0 items-center justify-between",
              "border-line border-b px-3",
            )}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Voltar"
              className={cn(
                "text-ink-4 inline-flex size-8 items-center justify-center rounded-md outline-none",
                "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              <ArrowLeftIcon className="size-4" strokeWidth={1.6} aria-hidden />
            </button>

            <DialogPrimitive.Title
              className={cn(
                "text-ink-1 text-[15px] font-semibold tracking-[-0.01em]",
                "max-w-[60vw] truncate sm:max-w-none",
              )}
            >
              Adicionar produto
            </DialogPrimitive.Title>

            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className={cn(
                "text-ink-4 inline-flex size-8 items-center justify-center rounded-md outline-none",
                "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              <XIcon className="size-4" strokeWidth={1.6} aria-hidden />
            </button>
          </header>

          {/* ── Busca — linha dedicada, full width. Resolve o problema do X
              de close ficar em cima do input. ── */}
          <div className="border-line shrink-0 border-b px-4 py-3 sm:px-5">
            <div className="relative">
              <SearchIcon
                size={14}
                className="text-ink-4 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                aria-hidden
              />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar produto por nome ou código"
                className="border-line focus:border-brand h-9 w-full rounded-md border bg-bg-card pl-9 pr-9 text-[13px] outline-none transition"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-ink-4 hover:text-ink-1 absolute top-1/2 right-3 -translate-y-1/2"
                  aria-label="Limpar busca"
                >
                  <XIcon size={14} strokeWidth={1.6} />
                </button>
              ) : null}
            </div>
          </div>

        {/* Chips de categoria — scroll horizontal em mobile */}
        {categories.length > 0 ? (
          <div className="border-line bg-bg-app shrink-0 border-b px-4 py-2.5 sm:px-5">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <CategoryChip
                label="Todos"
                count={totalProductCount}
                active={categoryId === null}
                onClick={() => setCategoryId(null)}
              />
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  count={c.productCount}
                  active={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Grid de produtos */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {isSearching && hits.length === 0 ? (
            <PickerSkeleton />
          ) : hits.length === 0 ? (
            <PickerEmpty hasQuery={q.trim() !== ""} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {hits.map((p) => {
                const isExpanded = expandedVariants.has(p.id);
                const hasVariants = p.variants.length > 0;
                const isSelected = selected.has(
                  selectionKey(p.id, null),
                );
                const selectedVariantIds = new Set(
                  [...selected.keys()]
                    .filter((k) => k.startsWith(`${p.id}::`))
                    .map((k) => k.split("::")[1]),
                );
                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isSelected={isSelected}
                    hasVariants={hasVariants}
                    isExpanded={isExpanded}
                    selectedVariantIds={selectedVariantIds}
                    onToggle={() => {
                      if (hasVariants) toggleVariants(p.id);
                      else toggleSelection(p, null);
                    }}
                    onToggleVariant={(v) => toggleSelection(p, v)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — contador + ações */}
        <div className="border-line bg-bg-app shrink-0 border-t px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-ink-3 text-[12px]">
              {selectedCount === 0 ? (
                <span>Nenhum produto selecionado</span>
              ) : (
                <span>
                  <strong className="text-ink-1">{selectedCount}</strong>{" "}
                  {selectedCount === 1 ? "selecionado" : "selecionados"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="b3-btn b3-btn--sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
                className={cn(
                  "b3-btn b3-btn--sm b3-btn--cta",
                  selectedCount === 0 && "cursor-not-allowed opacity-50",
                )}
              >
                <CheckIcon size={13} />
                {selectedCount === 0
                  ? "Adicionar"
                  : `Adicionar ${selectedCount}`}
              </button>
            </div>
          </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-[12px] transition",
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-bg-card text-ink-2 hover:bg-bg-app",
      )}
    >
      {label}
      <span className={cn("ml-1.5 text-[10.5px]", active ? "opacity-80" : "opacity-60")}>
        {count}
      </span>
    </button>
  );
}

function ProductCard({
  product,
  isSelected,
  hasVariants,
  isExpanded,
  selectedVariantIds,
  onToggle,
  onToggleVariant,
}: {
  product: PdvProductHit;
  isSelected: boolean;
  hasVariants: boolean;
  isExpanded: boolean;
  selectedVariantIds: Set<string | undefined>;
  onToggle: () => void;
  onToggleVariant: (v: PdvProductVariantHit) => void;
}) {
  const effectivePrice = getEffectivePrice(product);
  const onPromo =
    product.promoPriceInCents !== null &&
    product.promoPriceInCents < product.basePriceInCents;
  const isOutOfStock =
    !hasVariants &&
    product.trackStock &&
    product.stockQuantity !== null &&
    product.stockQuantity <= 0;
  const stockTone =
    !product.trackStock || product.stockQuantity === null
      ? "neutral"
      : product.stockQuantity <= 0
      ? "danger"
      : product.stockQuantity <= 3
      ? "warn"
      : "ok";

  return (
    <div
      className={cn(
        "border-line group flex flex-col overflow-hidden rounded-lg border bg-bg-card transition",
        isSelected && "border-brand bg-brand-wash",
        isExpanded && hasVariants && "border-brand",
        isOutOfStock && "opacity-50",
      )}
    >
      {/* Linha clicável principal */}
      <button
        type="button"
        onClick={onToggle}
        disabled={isOutOfStock}
        className="flex w-full items-center gap-2 p-2 text-left disabled:cursor-not-allowed"
      >
        {/* Thumb */}
        <div className="bg-bg-app shrink-0 overflow-hidden rounded-md">
          {product.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbUrl}
              alt={product.name}
              className="size-12 object-cover"
            />
          ) : (
            <div className="text-ink-4 flex size-12 items-center justify-center">
              <PackageIcon size={16} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="text-ink-1 line-clamp-2 text-[12px] font-medium leading-tight">
            {product.name}
          </div>
          {/* Audit 2026-05-21 — layout vertical quando promo (riscado em
              cima, novo embaixo). Antes era horizontal `flex items-baseline`
              com gap; em cards 5-col (160px), o riscado + novo preço
              juntos estouravam largura e quebravam linha com gap esquisito.
              Vertical garante hierarquia clara e cabe sempre. */}
          {onPromo ? (
            <div className="mt-1 leading-tight">
              <span className="text-ink-4 block text-[10px] tabular-nums line-through">
                {formatBRL(product.basePriceInCents)}
              </span>
              <span className="text-brand block text-[12.5px] font-semibold tabular-nums">
                {formatBRL(effectivePrice)}
              </span>
            </div>
          ) : (
            <div className="mt-1">
              <span className="text-ink-1 text-[12.5px] font-semibold tabular-nums">
                {formatBRL(effectivePrice)}
              </span>
            </div>
          )}
          {!hasVariants && product.trackStock && product.stockQuantity !== null ? (
            <div
              className={cn(
                "mt-0.5 text-[10px]",
                stockTone === "danger" && "text-danger",
                stockTone === "warn" && "text-warn",
                stockTone === "ok" && "text-ink-4",
              )}
            >
              {product.stockQuantity} em estoque
            </div>
          ) : null}
        </div>

        {/* Indicador: checkbox (sem variantes) ou chevron (com) */}
        <div className="shrink-0">
          {hasVariants ? (
            isExpanded ? (
              <ChevronDownIcon size={14} className="text-ink-4" />
            ) : (
              <ChevronRightIcon size={14} className="text-ink-4" />
            )
          ) : (
            <div
              className={cn(
                "border-line flex size-5 items-center justify-center rounded border",
                isSelected && "border-brand bg-brand",
              )}
            >
              {isSelected ? <CheckIcon size={12} className="text-white" /> : null}
            </div>
          )}
        </div>
      </button>

      {/* Variantes expansíveis */}
      {hasVariants && isExpanded ? (
        <div className="border-line border-t bg-bg-app">
          {product.variants.map((v) => {
            const variantPrice = getVariantPrice(product, v);
            const variantSelected = selectedVariantIds.has(v.id);
            const variantOut =
              v.trackStock &&
              v.stockQuantity !== null &&
              v.stockQuantity <= 0;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onToggleVariant(v)}
                disabled={variantOut}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40 disabled:cursor-not-allowed",
                  variantSelected && "bg-brand-wash",
                )}
              >
                <div
                  className={cn(
                    "border-line flex size-4 shrink-0 items-center justify-center rounded border",
                    variantSelected && "border-brand bg-brand",
                  )}
                >
                  {variantSelected ? (
                    <CheckIcon size={10} className="text-white" />
                  ) : null}
                </div>
                <span className="text-ink-1 flex-1 text-[11px] font-medium">
                  {v.name}
                </span>
                <span className="text-ink-2 text-[11px] tabular-nums">
                  {formatBRL(variantPrice)}
                </span>
                {v.trackStock && v.stockQuantity !== null ? (
                  <span
                    className={cn(
                      "text-[10px]",
                      variantOut
                        ? "text-danger"
                        : v.stockQuantity <= 3
                        ? "text-warn"
                        : "text-ink-4",
                    )}
                  >
                    {v.stockQuantity}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="bg-bg-app h-[88px] animate-pulse rounded-lg"
        />
      ))}
    </div>
  );
}

function PickerEmpty({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="text-ink-4 flex flex-col items-center justify-center gap-2 py-12 text-center text-[12px]">
      <Loader2Icon
        size={20}
        className={cn("opacity-40", hasQuery && "hidden")}
      />
      <span>
        {hasQuery
          ? "Nenhum produto encontrado pra essa busca."
          : "Nenhum produto cadastrado nessa categoria."}
      </span>
    </div>
  );
}
