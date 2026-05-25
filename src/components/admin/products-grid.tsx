"use client";

// Visualização em grid de cards de /admin/produtos — handoff Passo 9.
//
// Alternativa ao ProductsTable quando lojista visual (roupa, joia,
// perfumaria) prefere identificar produtos pela foto. Mesmo dataset
// (ProductTableRow), só muda a renderização.
//
// Card: foto quadrada 1:1 fullbleed em cima · meta abaixo (marca implícita
// via categoryName, nome, preço grande, badge de estoque/status).
// Click no card navega pra /admin/produtos/[id] (mesma href da tabela).

import { PackageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatBRL, hasActivePromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import type { ProductTableRow } from "./products-table";

export interface ProductsGridProps {
  products: ReadonlyArray<ProductTableRow>;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "··";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ProductsGrid({ products }: ProductsGridProps) {
  return (
    <div className="grid gap-3 p-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] sm:gap-4 sm:p-5">
      {products.map((p) => {
        const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
        const onPromoNow = hasActivePromo(p);
        const isOutOfStock = p.trackStock && (p.stockQuantity ?? 0) === 0;
        return (
          <Link
            key={p.id}
            href={`/admin/produtos/${p.id}`}
            prefetch
            className={cn(
              "group block overflow-hidden rounded-[10px] border border-line bg-surface transition-shadow",
              "hover:border-mangos-green-700/40 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mangos-yellow/45",
            )}
            aria-label={`Editar ${p.name || "rascunho"}`}
          >
            <div
              className="bg-bg-app relative w-full overflow-hidden border-b border-line"
              style={{ aspectRatio: "1 / 1" }}
            >
              {p.cover ? (
                <Image
                  src={p.cover}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 220px, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  {isDraft ? (
                    <PackageIcon className="text-ink-4 size-7" aria-hidden />
                  ) : (
                    <span
                      aria-hidden
                      className="text-[26px] font-bold uppercase tracking-tight text-brand"
                      style={{ color: "var(--brand)" }}
                    >
                      {getInitials(p.name)}
                    </span>
                  )}
                </div>
              )}
              {!p.isActive && !isDraft ? (
                <span className="b3-pill b3-pill--gold absolute right-2 top-2">
                  Pausado
                </span>
              ) : null}
              {isOutOfStock ? (
                <span className="b3-pill b3-pill--danger absolute right-2 top-2">
                  Sem estoque
                </span>
              ) : null}
            </div>
            <div className="space-y-1 p-3">
              {p.categoryName ? (
                <p className="text-ink-4 text-[11px] uppercase tracking-[0.04em]">
                  {p.categoryName}
                </p>
              ) : null}
              <p
                className={cn(
                  "text-ink-1 text-[13px] font-medium leading-snug",
                  "line-clamp-2 min-h-[34px]",
                )}
              >
                {isDraft ? (
                  <span className="italic text-ink-4">Rascunho sem nome</span>
                ) : (
                  p.name
                )}
              </p>
              <div className="flex items-baseline justify-between gap-2 pt-1">
                <span className="text-ink-1 font-mono text-[14px] font-bold tabular-nums">
                  {onPromoNow
                    ? formatBRL(p.promoPriceInCents!)
                    : formatBRL(p.basePriceInCents)}
                </span>
                {p.trackStock ? (
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      (p.stockQuantity ?? 0) === 0
                        ? "text-danger font-semibold"
                        : "text-ink-4",
                    )}
                  >
                    {p.stockQuantity ?? 0} un
                  </span>
                ) : (
                  <span className="text-ink-4 text-[10.5px] italic">
                    sem controle
                  </span>
                )}
              </div>
              {onPromoNow ? (
                <p
                  className="text-ink-4 font-mono text-[10.5px]"
                  style={{ textDecoration: "line-through" }}
                >
                  {formatBRL(p.basePriceInCents)}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
