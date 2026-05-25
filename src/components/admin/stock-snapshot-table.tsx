"use client";

/**
 * Tabela snapshot de saldo por produto — Onda 1.4 (2026-05-24).
 *
 * Aba primária do /admin/estoque. Substitui o mental model anterior
 * (feed event-sourced) pelo que o lojista espera: planilha-tipo-contador
 * com produto/saldo/min/status.
 *
 * Recursos:
 *   - Visão por produto-base; produtos com variantes mostram badge
 *     "N variantes" inline (sem expandir — visão é resumo, não breakdown)
 *   - Botão "+" inline reusa StockMovementDialog (mesmo dialog do
 *     /admin/produtos). Produto com variantes redireciona pra tela do
 *     produto (precisa escolher qual variante)
 *   - Click no row navega pra /admin/produtos/[id] (continua sendo o
 *     único caminho pra editar cadastro completo)
 *
 * NÃO inclui drafts (filtrados na server action).
 */
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  PackageIcon,
  PlusIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  StockSnapshotRow,
  StockSnapshotSort,
} from "@/actions/stock/types";
import { StockMovementDialog } from "@/components/admin/stock-movement-dialog";
import { cn } from "@/lib/utils";

export interface StockSnapshotTableProps {
  rows: ReadonlyArray<StockSnapshotRow>;
  /**
   * Sort ativo, pra renderizar o indicador ↑/↓ no cabeçalho clicado.
   * Sprint flash 2026-05-24 — Bloco 4 da master list.
   */
  currentSort: StockSnapshotSort;
}

type SortColumn = "name" | "stock" | "min";

interface SortHeaderProps {
  column: SortColumn;
  label: string;
  currentSort: StockSnapshotSort;
  align?: "left" | "right";
  className?: string;
}

/**
 * Cabeçalho de coluna clicável que escreve `?sort=` na URL preservando
 * todos os outros params (q, status, categoryId, page).
 *
 * Toggle: 1º clique = asc; clique de novo na mesma coluna = desc; clique
 * em outra coluna reseta pra asc. URL fica curtinha pq omitimos `name-asc`
 * (default).
 */
function SortHeader({
  column,
  label,
  currentSort,
  align = "left",
  className,
}: SortHeaderProps) {
  const searchParams = useSearchParams();
  const [currentCol, currentDir] = parseSort(currentSort);
  const isActive = currentCol === column;
  const nextDir: "asc" | "desc" = isActive && currentDir === "asc" ? "desc" : "asc";
  const nextSort: StockSnapshotSort = `${column}-${nextDir}` as StockSnapshotSort;

  const usp = new URLSearchParams(searchParams.toString());
  usp.delete("page");
  if (nextSort === "name-asc") {
    usp.delete("sort");
  } else {
    usp.set("sort", nextSort);
  }
  const href = `?${usp.toString()}`;

  const Indicator = !isActive
    ? ArrowUpDownIcon
    : currentDir === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <th
      style={{
        textAlign: align,
        padding: 0,
      }}
      className={className}
    >
      <Link
        href={href}
        replace
        scroll={false}
        className={cn(
          "hocus:bg-bg-app flex w-full items-center gap-1 px-3 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "justify-end",
        )}
      >
        <span>{label}</span>
        <Indicator
          size={10}
          className={cn(
            "opacity-40 transition-opacity",
            isActive && "opacity-90",
          )}
          aria-hidden
        />
      </Link>
    </th>
  );
}

function parseSort(sort: StockSnapshotSort): [SortColumn, "asc" | "desc"] {
  const dash = sort.lastIndexOf("-");
  const col = sort.slice(0, dash) as SortColumn;
  const dir = sort.slice(dash + 1) as "asc" | "desc";
  return [col, dir];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "··";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function StockSnapshotTable({
  rows,
  currentSort,
}: StockSnapshotTableProps) {
  const router = useRouter();

  return (
    <table className="b3-tbl">
      <thead>
        <tr>
          <th style={{ width: 64, paddingLeft: 20 }}>FOTO</th>
          <SortHeader column="name" label="PRODUTO" currentSort={currentSort} />
          <th style={{ paddingLeft: 12 }}>CATEGORIA</th>
          <SortHeader
            column="stock"
            label="SALDO"
            currentSort={currentSort}
            align="right"
          />
          <SortHeader
            column="min"
            label="MÍN"
            currentSort={currentSort}
            align="right"
          />
          <th style={{ paddingLeft: 12 }}>STATUS</th>
          <th style={{ width: 80, textAlign: "center" }}>AÇÃO</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const editHref = `/admin/produtos/${r.productId}`;
          const variantsLabel =
            r.variantCount > 0
              ? `${r.variantCount} variante${r.variantCount > 1 ? "s" : ""}`
              : null;
          return (
            <tr
              key={r.productId}
              onClick={() => router.push(editHref)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(editHref);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir produto ${r.productName}`}
              className="cursor-pointer outline-none focus-visible:bg-bg-app"
            >
              <td style={{ paddingLeft: 20 }}>
                <span
                  className="b3-avatar relative overflow-hidden"
                  style={{ borderRadius: 6 }}
                >
                  {r.cover ? (
                    <Image
                      src={r.cover}
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
                      {r.productName.trim() ? (
                        getInitials(r.productName)
                      ) : (
                        <PackageIcon className="size-4" />
                      )}
                    </span>
                  )}
                </span>
              </td>
              <td style={{ fontWeight: 600 }}>
                <div className="flex flex-col gap-0.5">
                  <span>{r.productName}</span>
                  {variantsLabel ? (
                    <span className="text-ink-4 text-[11px] font-normal">
                      {variantsLabel}
                    </span>
                  ) : null}
                </div>
              </td>
              <td>
                {r.categoryName ? (
                  <span className="b3-pill">{r.categoryName}</span>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                <SaldoCell
                  trackStock={r.trackStock}
                  stockQuantity={r.stockQuantity}
                  unit={r.unit}
                />
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {r.trackStock && r.minStockQuantity !== null ? (
                  <span className="tabular-nums">{r.minStockQuantity}</span>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
              <td>
                <StatusPill row={r} />
              </td>
              <td
                style={{ textAlign: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                <ActionCell row={r} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SaldoCell({
  trackStock,
  stockQuantity,
  unit,
}: {
  trackStock: boolean;
  stockQuantity: number | null;
  unit: string;
}) {
  if (!trackStock) {
    return <span className="text-ink-4">—</span>;
  }
  const q = stockQuantity ?? 0;
  return (
    <span className={cn("tabular-nums", q === 0 && "text-danger font-semibold")}>
      {q}
      {unit !== "un" ? (
        <span className="text-ink-4 ml-1 text-[11px]">{unit}</span>
      ) : null}
    </span>
  );
}

function StatusPill({ row }: { row: StockSnapshotRow }) {
  if (!row.trackStock) {
    return (
      <span
        className="b3-pill"
        title="Sem controle de estoque — produto não entra em relatórios. Ative em 'Editar produto' se for venda física."
      >
        Sem controle
      </span>
    );
  }
  const q = row.stockQuantity ?? 0;
  if (q === 0) {
    return <span className="b3-pill b3-pill--danger">Zerado</span>;
  }
  if (
    row.minStockQuantity !== null &&
    q <= row.minStockQuantity
  ) {
    return <span className="b3-pill b3-pill--gold">Repor</span>;
  }
  return <span className="b3-pill b3-pill--ok">OK</span>;
}

function ActionCell({ row }: { row: StockSnapshotRow }) {
  // Produto com variantes não suporta movimentação rápida (precisa escolher
  // qual variante). Mostra botão disabled com tooltip apontando o caminho.
  if (row.variantCount > 0) {
    return (
      <button
        type="button"
        disabled
        className="b3-btn b3-btn--sm size-7 p-0 opacity-40"
        title="Produto com variantes — abra o produto pra movimentar a variante específica."
        aria-label="Movimentar estoque (variantes — abra o produto)"
      >
        <PlusIcon size={13} aria-hidden />
      </button>
    );
  }
  // Produto sem variantes ou sem tracking: dialog rápido (manual_in,
  // manual_out, adjustment). O dialog em si lida com !trackStock — ele
  // permite registrar movement mas o trigger SQL não atualiza cache
  // (SQL 43 — trigger respeita trackStock); útil pra audit log apenas.
  // Pra produtos sem tracking, mostra ChevronRight em vez (abrir produto
  // pra ligar tracking antes).
  if (!row.trackStock) {
    return (
      <span
        className="text-ink-4 inline-flex items-center justify-center"
        title="Ative o controle de estoque no produto pra registrar movimentações"
      >
        <ChevronRightIcon size={13} aria-hidden />
      </span>
    );
  }
  return (
    <StockMovementDialog
      productId={row.productId}
      productName={row.productName}
      variants={[]}
      trigger={
        <button
          type="button"
          className="b3-btn b3-btn--sm size-7 p-0"
          title="Lançar movimentação rápida (entrada, saída ou ajuste)"
          aria-label="Movimentar estoque"
        >
          <PlusIcon size={13} aria-hidden />
        </button>
      }
    />
  );
}
