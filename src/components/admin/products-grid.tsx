"use client";

// Visualização em grid de cards de /admin/produtos — handoff Passo 9.
//
// Alternativa ao ProductsTable quando lojista visual (roupa, joia,
// perfumaria) prefere identificar produtos pela foto. Mesmo dataset
// (ProductTableRow), só muda a renderização.
//
// Card: foto quadrada 1:1 fullbleed em cima · meta abaixo (marca implícita
// via categoryName, nome, preço grande, badge de estoque/status).
// Click no card abre o workspace de edição via ?edit=, mesmo padrão da tabela.

import { PackageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatBRL, hasActivePromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { type ProductTableRow, TypePill } from "./products-table";

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
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] gap-3 p-4 sm:gap-4 sm:p-5">
      {products.map((p) => {
        const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
        const onPromoNow = hasActivePromo(p);
        const isOutOfStock = p.trackStock && (p.stockQuantity ?? 0) === 0;
        return (
          <Link
            key={p.id}
            href={`/admin/produtos?edit=${p.id}`}
            prefetch
            className={cn(
              "group border-line bg-surface block overflow-hidden rounded-[10px] border transition-shadow",
              "hover:border-mangos-green-700/40 hover:shadow-md",
              "focus-visible:ring-mangos-yellow/45 focus-visible:ring-2 focus-visible:outline-none",
            )}
            aria-label={`Editar ${p.name || "rascunho"}`}
          >
            <div
              className="bg-bg-app border-line relative w-full overflow-hidden border-b"
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
                      className="text-brand text-[26px] font-bold tracking-tight uppercase"
                      style={{ color: "var(--brand)" }}
                    >
                      {getInitials(p.name)}
                    </span>
                  )}
                </div>
              )}
              {!p.isActive && !isDraft ? (
                <span className="b3-pill b3-pill--gold absolute top-2 right-2">
                  Pausado
                </span>
              ) : null}
              {isOutOfStock ? (
                <span className="b3-pill b3-pill--danger absolute top-2 right-2">
                  Sem estoque
                </span>
              ) : null}
              {/* Onda 3 (2026-05-28): pill com universo (Produto público /
                  interno / Item de gestão / Serviço) no canto superior
                  esquerdo. Antes do fix o grid escondia esse dado, então
                  Item de gestão se misturava visualmente com produto
                  comum. */}
              {!isDraft ? (
                <div className="absolute top-2 left-2">
                  <TypePill
                    kind={p.kind}
                    isPublishedToStorefront={p.isPublishedToStorefront}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1 p-3">
              {p.categoryName ? (
                <p className="text-ink-4 text-[11px] tracking-[0.04em] uppercase">
                  {p.categoryName}
                </p>
              ) : null}
              <p
                className={cn(
                  "text-ink-1 text-[13px] leading-snug font-medium",
                  "line-clamp-2 min-h-[34px]",
                )}
              >
                {isDraft ? (
                  <span className="text-ink-4 italic">Rascunho sem nome</span>
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
