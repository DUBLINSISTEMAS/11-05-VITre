"use client";

// Lista de produtos do admin (port Dublin v3, Onda 5b).
//
// - Desktop (lg+): tabela densa estilo BAGY — checkbox · foto · nome+sku ·
//   preço · estoque · status pill · ações editar. Header monospace
//   uppercase em bg-app, linhas com grid CSS (não <table>; portanto NÃO
//   usa `b3-tbl` que é seletor de <table>).
// - Mobile (<lg): grid de cards visuais (mantém UX do lojista mobile-first).
//
// Status pills migram pra `b3-pill b3-pill--{ok,warn,danger}` Dublin.
// Selection state: `selectedIds` Set local. Quando >0, renderiza
// `<BulkActionsToolbar>` sticky bottom dentro do card de listagem.
// `onMutated` (do toolbar) limpa seleção e força re-render via router.refresh.
import {
  PackageIcon,
  PencilIcon,
  SparklesIcon,
} from "lucide-react";
import Image from "next/image";
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

  // Click em linha/card agora navega via <Link prefetch> pra
  // /admin/produtos/[id] — Next 15 baixa o JS da rota antes do click,
  // abertura ~instantânea. Substitui o antigo gate `?editar=<id>` +
  // ProductDialog (commit a931aac+). Auditoria 2026-05-12 mostrou que
  // 800 linhas de form em modal nunca rendem <100ms; página com prefetch
  // sim, e back nav do Next preserva scroll/cache da lista.

  const allIds = useMemo(() => products.map((p) => p.id), [products]);
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const partialSelected = selectedIds.size > 0 && !allSelected;

  const editHref = (id: string) => `/admin/produtos/${id}`;

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
      <div className="b3-card hidden overflow-hidden lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-bg-app grid grid-cols-[40px_64px_minmax(0,1.6fr)_100px_minmax(0,1fr)_100px_88px_40px] items-center gap-3 border-b border-line px-4 py-3"
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

        <ul role="rowgroup" className="divide-y divide-line">
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
                    ? "bg-brand-wash"
                    : "hover:bg-bg-app",
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
                  href={editHref(p.id)}
                  prefetch
                  className="bg-bg-app relative block size-12 shrink-0 overflow-hidden rounded-md"
                  aria-label={`Editar ${p.name || "rascunho"}`}
                >
                  {p.cover ? (
                    <Image
                      src={p.cover}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <PackageIcon className="text-ink-4 size-4" />
                    </span>
                  )}
                </Link>
                <Link
                  href={editHref(p.id)}
                  prefetch
                  className="hocus:text-brand min-w-0 truncate text-left text-[13px] font-medium text-ink-1 transition-colors"
                >
                  {isDraft ? (
                    <span className="text-ink-4 italic">
                      Rascunho sem nome
                    </span>
                  ) : (
                    p.name
                  )}
                </Link>
                <span className="font-mono text-[11.5px] text-ink-4">
                  {skuPlaceholder}
                </span>
                <span className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-mono text-[12.5px] text-ink-1 tabular-nums">
                    {formatPriceLabel(p)}
                  </span>
                  {onPromoNow ? (
                    <SparklesIcon
                      aria-label="Em promoção"
                      className="text-warn size-3"
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
                {/* Auditoria I2 (2026-05-12): antes era kebab MoreVerticalIcon
                    + aria-label "Abrir" — sugeria menu contextual que abria
                    direto o dialog de edit. Trocado pra PencilIcon + "Editar"
                    pra UX explícita. Ações destrutivas/publish ficam em
                    <ProductActionsMenu /> no header do dialog. */}
                <Link
                  href={editHref(p.id)}
                  prefetch
                  aria-label={`Editar ${p.name || "rascunho"}`}
                  className="hocus:bg-bg-app hocus:text-ink-1 flex size-7 items-center justify-center rounded-md text-ink-4 transition-colors"
                >
                  <PencilIcon className="size-4" />
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
                  "b3-card flex items-center gap-3 p-3",
                  isSelected && "ring-brand/30 ring-2",
                )}
              >
                <Checkbox
                  aria-label={`Selecionar ${p.name || "rascunho"}`}
                  checked={isSelected}
                  onCheckedChange={(c) => toggleOne(p.id, c === true)}
                />
                <Link
                  href={editHref(p.id)}
                  prefetch
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="bg-bg-app relative size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
                    {p.cover ? (
                      <Image
                        src={p.cover}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <PackageIcon className="text-ink-4 size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-ink-1">
                      {isDraft ? (
                        <span className="text-ink-4 italic">
                          Rascunho sem nome
                        </span>
                      ) : (
                        p.name
                      )}
                    </p>
                    <p className="text-ink-4 text-xs">
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
                        <span className="b3-pill b3-pill--warn">
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
    return <span className="text-[11.5px] text-ink-4">—</span>;
  }
  const q = quantity ?? 0;
  const isOut = q === 0;
  return (
    <span
      className={cn(
        "font-mono text-[12.5px] tabular-nums",
        isOut ? "text-danger" : "text-ink-1",
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
      <span className="b3-pill">
        <span aria-hidden className="bg-ink-4 size-1.5 rounded-full" />
        Rascunho
      </span>
    );
  }
  if (isOutOfStock) {
    return (
      <span className="b3-pill b3-pill--danger">
        <span aria-hidden className="bg-danger size-1.5 rounded-full" />
        Sem estoque
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="b3-pill b3-pill--ok">
        <span aria-hidden className="bg-ok size-1.5 rounded-full" />
        Visível
      </span>
    );
  }
  return (
    <span className="b3-pill">
      <span aria-hidden className="bg-ink-4 size-1.5 rounded-full" />
      Pausado
    </span>
  );
}
