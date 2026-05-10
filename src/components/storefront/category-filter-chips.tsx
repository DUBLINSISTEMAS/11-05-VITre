"use client";

/**
 * CategoryFilterChips — chips horizontais fiéis ao canvas-referencia (VTCategoria).
 *
 * Decisão Lote 2: 3 chips fixos hardcoded mapeados a filtros existentes:
 *   - Tudo        → `?` (sem filtro extra)
 *   - Em promoção → `?promo=1` (server filtra promoOnly em listProducts)
 *   - Novidades   → `?sort=newest`
 *
 * Material/atributo (Linho/Algodão do canvas linha 540) NÃO renderizar
 * como stub — só com schema futuro. Visual: height 28, padding-12,
 * rounded-full; ativo bg-foreground cor-background border-foreground;
 * inativo bg-muted/50 cor-foreground/70 border-border. Strip horizontal
 * scroll com snap-start, edge-to-edge no container do storefront mobile.
 *
 * Roteamento: `useRouter().replace()` preserva a rota atual e troca os
 * params relevantes (mantém `priceMin/priceMax/page` se houver — embora
 * removendo `page=1` ao trocar filtro pra evitar páginas vazias).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";

type ChipKey = "all" | "promo" | "newest";

interface ChipConfig {
  key: ChipKey;
  label: string;
}

const CHIPS: readonly ChipConfig[] = [
  { key: "all", label: "Tudo" },
  { key: "promo", label: "Em promoção" },
  { key: "newest", label: "Novidades" },
];

export interface CategoryFilterChipsProps {
  /**
   * Caminho base da listagem atual (ex: `/sandra-brito/categoria/vestidos`).
   * Usado pra replace sem reset de rota.
   */
  basePath: string;
}

export function CategoryFilterChips({ basePath }: CategoryFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeKey = useMemo<ChipKey>(() => {
    if (searchParams.get("promo") === "1") return "promo";
    if (searchParams.get("sort") === "newest") return "newest";
    return "all";
  }, [searchParams]);

  const handleClick = useCallback(
    (key: ChipKey) => {
      if (key === activeKey) return;

      // Preserva price filters; reseta page e zera sort/promo conforme chip.
      const next = new URLSearchParams();
      const priceMin = searchParams.get("priceMin");
      const priceMax = searchParams.get("priceMax");
      if (priceMin) next.set("priceMin", priceMin);
      if (priceMax) next.set("priceMax", priceMax);

      if (key === "promo") next.set("promo", "1");
      if (key === "newest") next.set("sort", "newest");

      const qs = next.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [activeKey, basePath, router, searchParams],
  );

  return (
    <div
      role="tablist"
      aria-label="Filtros da categoria"
      className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map((chip) => {
        const active = chip.key === activeKey;
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleClick(chip.key)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-[11.5px] font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-muted/50 text-foreground/70 hover:bg-muted",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
