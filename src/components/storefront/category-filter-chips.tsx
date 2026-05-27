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
 * Onda 4 (2026-05-27): botão "Filtros" no fim da strip abre Sheet com
 * controles de preço (min/max em reais) + sort (relevância / preço asc/desc
 * / mais novos). Antes a URL aceitava `?priceMin=&priceMax=&sort=` mas
 * não havia UI — cliente que queria "ordenar por menor preço" não tinha
 * caminho (régua "funciona ou esconde" foi violada).
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
import { ListFilter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StorefrontAttribute } from "@/lib/storefront/attributes-loader";
import { cn } from "@/lib/utils";

type SortValue = "relevance" | "price_asc" | "price_desc" | "newest";
const SORT_LABEL: Record<SortValue, string> = {
  relevance: "Relevância",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  newest: "Mais novos",
};
function isSortValue(v: string | null): v is SortValue {
  return v === "relevance" || v === "price_asc" || v === "price_desc" || v === "newest";
}

// Cents (URL) ↔ reais inteiros (input do usuário). Cliente lojista BR
// usa preços inteiros em reais — não precisamos de centavos no filtro.
function centsToReaisString(cents: string | null): string {
  if (!cents) return "";
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.floor(n / 100));
}
function reaisStringToCents(value: string): number | null {
  const trimmed = value.replace(/[^0-9]/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n * 100;
}

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

  // ─── Onda 4: filtros preço + sort em Sheet ──────────────────────
  const currentPriceMin = searchParams.get("priceMin");
  const currentPriceMax = searchParams.get("priceMax");
  const currentSortRaw = searchParams.get("sort");
  const currentSort: SortValue = isSortValue(currentSortRaw)
    ? currentSortRaw
    : "relevance";

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPriceMin, setDraftPriceMin] = useState(centsToReaisString(currentPriceMin));
  const [draftPriceMax, setDraftPriceMax] = useState(centsToReaisString(currentPriceMax));
  const [draftSort, setDraftSort] = useState<SortValue>(currentSort);

  // Hidrata os drafts ao abrir o sheet (caso URL tenha mudado por trás).
  useEffect(() => {
    if (!filtersOpen) return;
    setDraftPriceMin(centsToReaisString(currentPriceMin));
    setDraftPriceMax(centsToReaisString(currentPriceMax));
    setDraftSort(currentSort);
  }, [filtersOpen, currentPriceMin, currentPriceMax, currentSort]);

  // Contagem de filtros aplicados pra badge no botão.
  const activeFilterCount =
    (currentPriceMin ? 1 : 0) +
    (currentPriceMax ? 1 : 0) +
    (currentSort !== "relevance" && currentSort !== "newest" ? 1 : 0);

  const handleApplyFilters = () => {
    const next = new URLSearchParams();
    // Preserva attr ativo (filtro de atributo é independente).
    if (activeAttrValueId) next.set("attr", activeAttrValueId);
    // Preserva promo se ativo na URL atual.
    if (searchParams.get("promo") === "1") next.set("promo", "1");

    const minCents = reaisStringToCents(draftPriceMin);
    const maxCents = reaisStringToCents(draftPriceMax);
    if (minCents !== null) next.set("priceMin", String(minCents));
    if (maxCents !== null) next.set("priceMax", String(maxCents));
    if (draftSort !== "relevance") next.set("sort", draftSort);

    const qs = next.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setDraftPriceMin("");
    setDraftPriceMax("");
    setDraftSort("relevance");
  };

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

      {/* Onda 4 (2026-05-27): botão Filtros sempre presente, badge com
          contador quando há filtros aplicados (preço/sort). Sheet à direita
          (consistente com pattern de filter side-sheet de e-commerce). */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold tracking-[-0.1px] transition-all outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeFilterCount > 0
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-foreground/70 hover:border-foreground/30 hover:text-foreground",
          )}
          aria-label={
            activeFilterCount > 0
              ? `Filtros · ${activeFilterCount} ativos`
              : "Abrir filtros"
          }
          style={{ touchAction: "manipulation" }}
        >
          <ListFilter className="size-3.5" strokeWidth={2} aria-hidden />
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <span
              aria-hidden
              className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 font-mono text-[10px] font-bold leading-none text-foreground"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        <SheetContent side="right" className="w-[88vw] max-w-[380px] flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-[15px] font-semibold tracking-[-0.2px]">
              Filtros
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Sort */}
            <section className="space-y-2">
              <Label htmlFor="filter-sort" className="text-[12px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Ordenar por
              </Label>
              <Select
                value={draftSort}
                onValueChange={(v) => setDraftSort(v as SortValue)}
              >
                <SelectTrigger id="filter-sort" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(["relevance", "price_asc", "price_desc", "newest"] as SortValue[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* Preço */}
            <section className="space-y-2">
              <Label className="text-[12px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Faixa de preço (R$)
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="filter-price-min" className="text-[11px] text-muted-foreground">
                    De
                  </Label>
                  <Input
                    id="filter-price-min"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    min={0}
                    step={1}
                    value={draftPriceMin}
                    onChange={(e) => setDraftPriceMin(e.target.value)}
                    className="h-10"
                  />
                </div>
                <span aria-hidden className="text-muted-foreground pt-5">
                  —
                </span>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="filter-price-max" className="text-[11px] text-muted-foreground">
                    Até
                  </Label>
                  <Input
                    id="filter-price-max"
                    type="number"
                    inputMode="numeric"
                    placeholder="∞"
                    min={0}
                    step={1}
                    value={draftPriceMax}
                    onChange={(e) => setDraftPriceMax(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Valores em reais inteiros. Deixe em branco pra não filtrar.
              </p>
            </section>
          </div>

          <SheetFooter className="flex-row gap-2 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1"
            >
              Limpar
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                onClick={handleApplyFilters}
                className="flex-1"
              >
                Aplicar
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
