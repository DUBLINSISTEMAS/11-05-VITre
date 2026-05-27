"use client";

/**
 * CategoryFilterChips — chips horizontais fiéis ao canvas-referencia (VTCategoria).
 *
 * Sprint 5.5 (2026-05-22) — chips de atributo dinâmicos.
 * Os 3 chips fixos (Tudo / Em promoção / Novidades) seguem como sempre,
 * MAS depois deles renderiza N chips por valor de atributo ativo da loja
 * (Cor: Azul, Tamanho: M, Material: Algodão). Cada chip controla
 * `?attr={attributeValueId}` na URL — single value, lojista escolhe um
 * filtro por vez. Quando ativo, vira "Atributo: Valor" pra ficar claro.
 *
 * Visual: height 28, padding-12, rounded-full; ativo
 * bg-foreground cor-background border-foreground; inativo bg-muted/50
 * cor-foreground/70 border-border. Strip horizontal scroll com snap-start.
 *
 * Atributo type='color' mostra dot circular com colorHex à esquerda do label.
 *
 * Roteamento: `useRouter().replace()` preserva price filters; reseta
 * page e zera os outros chips fixos quando atributo é escolhido.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { StorefrontAttribute } from "@/lib/storefront/attributes-loader";
import { cn } from "@/lib/utils";

type FixedKey = "all" | "promo" | "newest";

interface FixedChip {
  key: FixedKey;
  label: string;
}

const FIXED_CHIPS: readonly FixedChip[] = [
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
  /**
   * Sprint 5.5 — atributos ativos da loja com seus valores. Quando vazio,
   * comportamento herdado (só os 3 chips fixos).
   */
  attributes?: StorefrontAttribute[];
}

export function CategoryFilterChips({
  basePath,
  attributes = [],
}: CategoryFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeAttrValueId = searchParams.get("attr");

  const activeFixed = useMemo<FixedKey>(() => {
    if (activeAttrValueId) return "all"; // atributo ativo neutraliza fixed
    if (searchParams.get("promo") === "1") return "promo";
    if (searchParams.get("sort") === "newest") return "newest";
    return "all";
  }, [searchParams, activeAttrValueId]);

  const buildHref = useCallback(
    (next: URLSearchParams): string => {
      // Preserva price filters; reseta page sempre.
      const priceMin = searchParams.get("priceMin");
      const priceMax = searchParams.get("priceMax");
      if (priceMin) next.set("priceMin", priceMin);
      if (priceMax) next.set("priceMax", priceMax);
      const qs = next.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    },
    [basePath, searchParams],
  );

  const handleFixedClick = useCallback(
    (key: FixedKey) => {
      if (key === activeFixed && !activeAttrValueId) return;
      const next = new URLSearchParams();
      if (key === "promo") next.set("promo", "1");
      if (key === "newest") next.set("sort", "newest");
      router.replace(buildHref(next), { scroll: false });
    },
    [activeFixed, activeAttrValueId, router, buildHref],
  );

  const handleAttrClick = useCallback(
    (valueId: string) => {
      const next = new URLSearchParams();
      // Toggle: clicar no mesmo valor ativo limpa.
      if (activeAttrValueId !== valueId) {
        next.set("attr", valueId);
      }
      router.replace(buildHref(next), { scroll: false });
    },
    [activeAttrValueId, router, buildHref],
  );

  return (
    <div
      role="tablist"
      aria-label="Filtros da categoria"
      className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {FIXED_CHIPS.map((chip) => {
        const active = chip.key === activeFixed && !activeAttrValueId;
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleFixedClick(chip.key)}
            className={cn(
              // Chip maior ref Dribbble 1: h-9 (36px), padding 14, text 13px.
              // Active state: pill primary (verde Mangos Pay) com texto
              // contrastante. Inactive: outline neutro.
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold tracking-[-0.1px] transition-all outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgba(27,122,79,0.45)]"
                : "border-border bg-background text-foreground/70 hover:border-foreground/30 hover:text-foreground",
            )}
            style={{ touchAction: "manipulation" }}
          >
            {chip.label}
          </button>
        );
      })}

      {/* Sprint 5.5 — chips dinâmicos por valor de atributo. */}
      {attributes.flatMap((attr) =>
        attr.values.map((v) => {
          const active = activeAttrValueId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleAttrClick(v.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold tracking-[-0.1px] transition-all outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgba(27,122,79,0.45)]"
                  : "border-border bg-background text-foreground/70 hover:border-foreground/30 hover:text-foreground",
              )}
              title={`${attr.name}: ${v.label}`}
              style={{ touchAction: "manipulation" }}
            >
              {attr.type === "color" && v.colorHex ? (
                <span
                  className={cn(
                    "size-3.5 shrink-0 rounded-full border",
                    active ? "border-white/40" : "border-foreground/10",
                  )}
                  style={{ background: v.colorHex }}
                  aria-hidden
                />
              ) : null}
              {/* Quando ativo, mostra "Atributo: Valor". Quando não,
                  só o valor — chip mais limpo. */}
              {active ? `${attr.name}: ${v.label}` : v.label}
            </button>
          );
        }),
      )}
    </div>
  );
}
