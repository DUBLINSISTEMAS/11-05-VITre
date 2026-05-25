"use client";

// Lista de produtos do admin — port Dublin v3 (ADR-0019, Onda A.7).
//
// Tabela `b3-tbl` pixel-perfect. Click em row navega pra /admin/produtos/[id]
// (Next 15 prefetch). a11y: <tr> com tabIndex + role=button + onKeyDown +
// aria-label (mesmo pattern A.6).
//
// Colunas: checkbox / FOTO (b3-avatar) / NOME / CATEGORIA (b3-pill) /
// ESTOQUE (mono right) / PREÇO (mono right, promo c/ strikethrough) / STATUS.
// SKU do handoff omitido — Mangos Pay schema atual sem SKU em productTable.
//
// Selection state pra <BulkActionsToolbar> preservado. Stop propagation
// no checkbox pra não disparar navegação.
import { PackageIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, hasActivePromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { StockMovementDialog } from "./stock-movement-dialog";

export interface ProductTableRow {
  id: string;
  name: string;
  slug: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  isActive: boolean;
  isPublishedToStorefront: boolean;
  trackStock: boolean;
  stockQuantity: number | null;
  cover: string | null;
  /** Nome da categoria (server-resolved via map). null se sem categoria. */
  categoryName: string | null;
  /**
   * Onda 1.4 (2026-05-24) — quantas variantes o produto tem.
   * Usado pelo botão "+" inline na coluna ESTOQUE: produto com variantes
   * NÃO permite movimentação rápida (precisa abrir a tela do produto pra
   * escolher qual variante). Botão fica desabilitado com tooltip.
   */
  variantCount: number;
}

export interface ProductsTableProps {
  products: ReadonlyArray<ProductTableRow>;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "··";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
    <>
      <table className="b3-tbl">
        <thead>
          <tr>
            <th style={{ paddingLeft: 20, width: 40 }}>
              <span className="flex items-center justify-center">
                <Checkbox
                  aria-label="Selecionar todos"
                  checked={allSelected || (partialSelected && "indeterminate")}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
            </th>
            <th style={{ width: 64 }}>FOTO</th>
            <th>NOME</th>
            <th>CATEGORIA</th>
            <th style={{ textAlign: "right" }}>ESTOQUE</th>
            <th style={{ textAlign: "right" }}>PREÇO</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
            const onPromoNow = hasActivePromo(p);
            const isSelected = selectedIds.has(p.id);
            const editHref = `/admin/produtos/${p.id}`;
            return (
              <tr
                key={p.id}
                onClick={() => router.push(editHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(editHref);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Editar ${p.name || "rascunho"}`}
                className={cn(
                  "cursor-pointer outline-none focus-visible:bg-bg-app",
                  isSelected && "bg-brand-wash",
                )}
              >
                <td style={{ paddingLeft: 20 }} onClick={(e) => e.stopPropagation()}>
                  <span className="flex items-center justify-center">
                    <Checkbox
                      aria-label={`Selecionar ${p.name || "rascunho"}`}
                      checked={isSelected}
                      onCheckedChange={(c) => toggleOne(p.id, c === true)}
                    />
                  </span>
                </td>
                <td>
                  <span className="b3-avatar relative overflow-hidden" style={{ borderRadius: 6 }}>
                    {p.cover ? (
                      <Image
                        src={p.cover}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mono text-[11px] font-bold text-brand"
                        style={{ color: "var(--brand)" }}
                      >
                        {isDraft ? <PackageIcon className="size-4" /> : getInitials(p.name)}
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>
                  {isDraft ? (
                    <span className="italic text-ink-4">Rascunho sem nome</span>
                  ) : (
                    p.name
                  )}
                </td>
                <td>
                  {p.categoryName ? (
                    <span className="b3-pill">{p.categoryName}</span>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td className="mono" style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <StockCell
                    productId={p.id}
                    productName={p.name}
                    trackStock={p.trackStock}
                    quantity={p.stockQuantity}
                    variantCount={p.variantCount}
                  />
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                  {onPromoNow ? (
                    <>
                      {formatBRL(p.promoPriceInCents!)}
                      <br />
                      <small className="text-ink-4" style={{ textDecoration: "line-through", fontSize: 10.5, fontWeight: 400 }}>
                        {formatBRL(p.basePriceInCents)}
                      </small>
                    </>
                  ) : (
                    formatBRL(p.basePriceInCents)
                  )}
                </td>
                <td>
                  <StatusPill
                    isActive={p.isActive}
                    isPublishedToStorefront={p.isPublishedToStorefront}
                    trackStock={p.trackStock}
                    quantity={p.stockQuantity}
                    isDraft={isDraft}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        onMutated={handleMutated}
      />
    </>
  );
}

function StockCell({
  productId,
  productName,
  trackStock,
  quantity,
  variantCount,
}: {
  productId: string;
  productName: string;
  trackStock: boolean;
  quantity: number | null;
  variantCount: number;
}) {
  if (!trackStock) {
    // Onda 1.4 (2026-05-24): substituído "—" silencioso por badge explícito.
    // Antes lojista olhava a tabela e via "—" sem entender que esse produto
    // está FORA do controle de estoque. Badge gera atrito visual proposital
    // (cinza neutro, sem cor de alerta) e tooltip explica o significado.
    return (
      <span
        className="b3-pill"
        title="Sem controle de estoque — produto não entra em relatórios. Ative em 'Editar produto' se for venda física."
      >
        Sem controle
      </span>
    );
  }
  const q = quantity ?? 0;
  // Onda 1.4 — botão "+" inline pra movimentação rápida sem abrir o produto.
  // Produto COM variantes não suporta movimentação rápida (precisa escolher
  // qual variante movimentar) — botão fica desabilitado com tooltip apontando
  // o caminho. Caso comum (sem variantes) = 2 cliques: tabela → "+" → dialog.
  const hasVariants = variantCount > 0;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className={cn("tabular-nums", q === 0 && "text-danger")}>{q}</span>
      {hasVariants ? (
        <button
          type="button"
          disabled
          className="b3-btn b3-btn--sm size-6 p-0 opacity-40"
          style={{ minWidth: 24 }}
          title="Produto com variantes — abra o produto para movimentar a variante específica."
          aria-label="Movimentar estoque (variantes — abra o produto)"
        >
          <PlusIcon size={12} aria-hidden />
        </button>
      ) : (
        <StockMovementDialog
          productId={productId}
          productName={productName}
          variants={[]}
          trigger={
            <button
              type="button"
              className="b3-btn b3-btn--sm size-6 p-0"
              style={{ minWidth: 24 }}
              title="Lançar movimentação rápida (entrada, saída ou ajuste)"
              aria-label="Movimentar estoque"
              onClick={(e) => e.stopPropagation()}
            >
              <PlusIcon size={12} aria-hidden />
            </button>
          }
        />
      )}
    </span>
  );
}

function StatusPill({
  isActive,
  isPublishedToStorefront,
  trackStock,
  quantity,
  isDraft,
}: {
  isActive: boolean;
  isPublishedToStorefront: boolean;
  trackStock: boolean;
  quantity: number | null;
  isDraft: boolean;
}) {
  const isOutOfStock = trackStock && (quantity ?? 0) === 0;
  if (isDraft) {
    return <span className="b3-pill">Rascunho</span>;
  }
  if (!isActive) {
    return <span className="b3-pill b3-pill--gold">Pausado</span>;
  }
  if (isOutOfStock) {
    return <span className="b3-pill b3-pill--danger">Sem estoque</span>;
  }
  if (!isPublishedToStorefront) {
    return (
      <span className="b3-pill b3-pill--silver" title="Ativo no sistema mas oculto da vitrine pública. Disponível pra venda no PDV.">
        Só PDV
      </span>
    );
  }
  return <span className="b3-pill b3-pill--ok">Na loja online</span>;
}
