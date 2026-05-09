"use client";

/**
 * Drawer de filtros (preço min/max + ordenar) compartilhado por
 * páginas de categoria e busca.
 *
 * Estado é fonte da URL — ao confirmar, faz `router.replace` com os
 * params novos. Sem estado em memória além do form local enquanto o
 * usuário digita.
 */
import { Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SORT_OPTIONS = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "newest", label: "Novidades" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface FiltersDrawerProps {
  /** Path base (ex: `/sandra-brito-collection/categoria/aneis`). */
  basePath: string;
}

function parseCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function centsToDisplay(cents: string | null): string {
  if (!cents) return "";
  const num = Number(cents);
  if (!Number.isFinite(num)) return "";
  return (num / 100).toFixed(2).replace(".", ",");
}

export function FiltersDrawer({ basePath }: FiltersDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentSort = (searchParams.get("sort") ?? "relevance") as SortValue;
  const currentMin = centsToDisplay(searchParams.get("priceMin"));
  const currentMax = centsToDisplay(searchParams.get("priceMax"));

  const activeCount =
    (searchParams.get("priceMin") ? 1 : 0) +
    (searchParams.get("priceMax") ? 1 : 0) +
    (searchParams.get("sort") && searchParams.get("sort") !== "relevance"
      ? 1
      : 0);

  // Preserva params que não controlamos (q, etc).
  const buildPreservedParams = () => {
    const params = new URLSearchParams();
    for (const [k, v] of searchParams.entries()) {
      if (k !== "priceMin" && k !== "priceMax" && k !== "sort" && k !== "page") {
        params.set(k, v);
      }
    }
    return params;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let priceMin = parseCents(String(formData.get("priceMin") ?? ""));
    let priceMax = parseCents(String(formData.get("priceMax") ?? ""));
    const sort = String(formData.get("sort") ?? "relevance");

    // Auto-swap se usuário inverteu min/max — padrão Mercado Livre/Amazon.
    // Evita "0 resultados" confuso quando a intenção era óbvia.
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }

    const params = buildPreservedParams();
    if (priceMin !== null) params.set("priceMin", String(priceMin));
    if (priceMax !== null) params.set("priceMax", String(priceMax));
    if (sort !== "relevance") params.set("sort", sort);
    // page sempre reseta pra 1 ao filtrar.

    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    setOpen(false);
  };

  const handleClear = () => {
    const params = buildPreservedParams();
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Filter className="size-4" aria-hidden />
          Filtrar
          {activeCount > 0 && (
            <span
              aria-hidden
              className="bg-primary text-primary-foreground ml-1 grid size-5 place-items-center rounded-full text-[10px] font-semibold tabular-nums"
            >
              {activeCount}
            </span>
          )}
          <span className="sr-only">
            {activeCount > 0
              ? `${activeCount} filtro(s) aplicado(s)`
              : "Nenhum filtro aplicado"}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[88vw] max-w-sm gap-0 p-0"
      >
        <SheetHeader className="border-border/60 border-b px-5 py-4">
          <SheetTitle>Filtrar</SheetTitle>
          <SheetDescription>
            Refine sua busca por preço e ordenação.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <fieldset className="space-y-3">
              <legend className="text-foreground text-sm font-semibold">
                Faixa de preço
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="priceMin" className="text-xs">
                    Mínimo (R$)
                  </Label>
                  <Input
                    id="priceMin"
                    name="priceMin"
                    inputMode="decimal"
                    defaultValue={currentMin}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priceMax" className="text-xs">
                    Máximo (R$)
                  </Label>
                  <Input
                    id="priceMax"
                    name="priceMax"
                    inputMode="decimal"
                    defaultValue={currentMax}
                    placeholder="999,00"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-foreground text-sm font-semibold">
                Ordenar por
              </legend>
              <RadioGroup
                defaultValue={currentSort}
                name="sort"
                className="space-y-1.5"
              >
                {SORT_OPTIONS.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`sort-${opt.value}`}
                    className="hocus:bg-accent/40 has-[input:checked]:bg-primary/10 has-[input:checked]:text-foreground flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                  >
                    <RadioGroupItem
                      id={`sort-${opt.value}`}
                      value={opt.value}
                    />
                    {opt.label}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>

          <div className="border-border/60 flex gap-2 border-t px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="flex-1"
            >
              Limpar
            </Button>
            <Button type="submit" className="flex-1">
              Aplicar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
