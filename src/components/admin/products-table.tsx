"use client";

// Lista de produtos do admin (canvas-v1 admin Lote 3).
//
// - Desktop (lg+): tabela densa estilo canvas — checkbox · foto 64×80 ·
//   nome+sku · preço · estoque · status pill · ações kebab. Header
//   monospace uppercase. Linhas grid template fixo.
// - Mobile (<lg): grid de cards visuais (mantém UX da Sandra hoje).
//
// Selection state: `selectedIds` Set local. Quando >0, renderiza
// `<BulkActionsToolbar>` sticky bottom dentro do card de listagem.
// `onMutated` (do toolbar) limpa seleção e força re-render via router.refresh.
import {
  MoreVerticalIcon,
  PackageIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { formatPriceLabel, hasActivePromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { BulkActionsToolbar } from "./bulk-actions-toolbar";

export interface ProductTableRow {
  id: string;
  name: string;
  slug: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  isActive: boolean;
  trackStock: boolean;
  stockQuantity: number | null;
  cover: string | null;
}

export interface ProductsTableProps {
  products: ReadonlyArray<ProductTableRow>;
}

export function ProductsTable({ products }: ProductsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => products.map((p) => p.id), [products]);
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const partialSelected = selectedIds.size > 0 && !allSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(allIds) : new Set());
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleMutated = () => {
    clearSelection();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Desktop: tabela densa */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-muted/50 grid grid-cols-[40px_64px_minmax(0,1.6fr)_100px_minmax(0,1fr)_100px_88px_40px] items-center gap-3 border-b px-4 py-3"
        >
          <span aria-hidden className="flex items-center justify-center">
            <Checkbox
              aria-label="Selecionar todos"
              checked={allSelected || (partialSelected && "indeterminate")}
              onCheckedChange={(c) => toggleAll(c === true)}
            />
          </span>
          <span aria-hidden />
          <span>Produto</span>
          <span>SKU</span>
          <span>Preço</span>
          <span>Estoque</span>
          <span>Status</span>
          <span aria-hidden />
        </div>

        <ul role="rowgroup" className="divide-y">
          {products.map((p) => {
            const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
            const onPromoNow = hasActivePromo(p);
            const isSelected = selectedIds.has(p.id);
            const skuPlaceholder = p.id.slice(0, 8).toUpperCase();
            return (
              <li
                key={p.id}
                role="row"
                className={cn(
                  "grid grid-cols-[40px_64px_minmax(0,1.6fr)_100px_minmax(0,1fr)_100px_88px_40px] items-center gap-3 px-4 py-3 transition-colors",
                  isSelected
                    ? "bg-primary/5"
                    : "hover:bg-accent/30",
                )}
              >
                <span className="flex items-center justify-center">
                  <Checkbox
                    aria-label={`Selecionar ${p.name || "rascunho"}`}
                    checked={isSelected}
                    onCheckedChange={(c) => toggleOne(p.id, c === true)}
                  />
                </span>
                <Link
                  href={`/admin/produtos/${p.id}/editar`}
                  prefetch
                  className="bg-muted relative block size-12 shrink-0 overflow-hidden rounded-md"
                  aria-label={`Editar ${p.name || "rascunho"}`}
                >
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.cover}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <PackageIcon className="text-muted-foreground size-4" />
                    </span>
                  )}
                </Link>
                <Link
                  href={`/admin/produtos/${p.id}/editar`}
                  prefetch
                  className="hocus:text-primary min-w-0 truncate text-[13px] font-medium text-foreground transition-colors"
                >
                  {isDraft ? (
                    <span className="text-muted-foreground italic">
                      Rascunho sem nome
                    </span>
                  ) : (
                    p.name
                  )}
                </Link>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {skuPlaceholder}
                </span>
                <span className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-mono text-[12.5px] text-foreground tabular-nums">
                    {formatPriceLabel(p)}
                  </span>
                  {onPromoNow ? (
                    <SparklesIcon
                      aria-label="Em promoção"
                      className="text-warning-foreground size-3"
                    />
                  ) : null}
                </span>
                <StockCell trackStock={p.trackStock} quantity={p.stockQuantity} />
                <StatusPill
                  isActive={p.isActive}
                  trackStock={p.trackStock}
                  quantity={p.stockQuantity}
                  isDraft={isDraft}
                />
                <Link
                  href={`/admin/produtos/${p.id}/editar`}
                  prefetch
                  aria-label="Abrir"
                  className="hocus:bg-accent flex size-7 items-center justify-center rounded-md text-muted-foreground"
                >
                  <MoreVerticalIcon className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile: cards visuais (mantido) */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {products.map((p) => {
          const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
          const onPromoNow = hasActivePromo(p);
          const isSelected = selectedIds.has(p.id);
          return (
            <li key={p.id}>
              <div
                className={cn(
                  "bg-card flex items-center gap-3 rounded-xl border p-3",
                  isSelected && "ring-primary/30 ring-2",
                )}
              >
                <Checkbox
                  aria-label={`Selecionar ${p.name || "rascunho"}`}
                  checked={isSelected}
                  onCheckedChange={(c) => toggleOne(p.id, c === true)}
                />
                <Link
                  href={`/admin/produtos/${p.id}/editar`}
                  prefetch
                  className="flex flex-1 items-center gap-3"
                >
                  <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
                    {p.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <PackageIcon className="text-muted-foreground size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium">
                      {isDraft ? (
                        <span className="text-muted-foreground italic">
                          Rascunho sem nome
                        </span>
                      ) : (
                        p.name
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatPriceLabel(p)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusPill
                        isActive={p.isActive}
                        trackStock={p.trackStock}
                        quantity={p.stockQuantity}
                        isDraft={isDraft}
                      />
                      {onPromoNow ? (
                        <span className="bg-warning-soft text-warning-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                          <SparklesIcon className="size-2.5" /> Promo
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Bulk toolbar (sticky bottom dentro do card de listagem) */}
      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        onMutated={handleMutated}
      />
    </div>
  );
}

function StockCell({
  trackStock,
  quantity,
}: {
  trackStock: boolean;
  quantity: number | null;
}) {
  if (!trackStock) {
    return <span className="text-[11.5px] text-muted-foreground">—</span>;
  }
  const q = quantity ?? 0;
  const isOut = q === 0;
  return (
    <span
      className={cn(
        "font-mono text-[12.5px] tabular-nums",
        isOut ? "text-destructive" : "text-foreground",
      )}
    >
      {q}
    </span>
  );
}

function StatusPill({
  isActive,
  trackStock,
  quantity,
  isDraft,
}: {
  isActive: boolean;
  trackStock: boolean;
  quantity: number | null;
  isDraft: boolean;
}) {
  const isOutOfStock = trackStock && (quantity ?? 0) === 0;
  if (isDraft) {
    return (
      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium">
        <span aria-hidden className="bg-muted-foreground size-1.5 rounded-full" />
        Rascunho
      </span>
    );
  }
  if (isOutOfStock) {
    return (
      <span className="bg-destructive-soft text-destructive inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium">
        <span aria-hidden className="bg-destructive size-1.5 rounded-full" />
        Sem estoque
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="bg-success-soft text-success-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium">
        <span aria-hidden className="bg-success size-1.5 rounded-full" />
        Visível
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium">
      <span aria-hidden className="bg-muted-foreground size-1.5 rounded-full" />
      Pausado
    </span>
  );
}
