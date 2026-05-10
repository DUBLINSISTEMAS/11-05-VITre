"use client";

import { SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { CategoryOption } from "./category-dialog";

const CATEGORY_ALL = "__all__";

interface ProductsFiltersProps {
  categories: CategoryOption[];
}

/**
 * Filtros da lista de produtos (canvas-v1 admin Lote 3 — sem select de
 * status, que migrou pra `<ProductsStatusTabs>`). URL-driven: cada
 * mudança replaceia `?q=&categoryId=&promo=` e o RSC re-renderiza.
 *
 * - Busca: debounce de 300ms (com hint ⌘K visual decorativo).
 * - Categoria/Promo: imediato.
 * - Toda mudança reseta `?page=1`.
 */
export function ProductsFilters({ categories }: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("categoryId") ?? CATEGORY_ALL;
  const onlyPromo = searchParams.get("promo") === "1";

  const [q, setQ] = useState(initialQ);

  // Debounce input → URL. Lê window.location.search dentro do timeout pra
  // não capturar URLSearchParams stale; comparação evita replace redundante
  // que mexeria em scroll/foco.
  useEffect(() => {
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(window.location.search);
      const current = usp.get("q") ?? "";
      if (q === current) return;
      const trimmed = q.trim();
      if (trimmed) usp.set("q", trimmed);
      else usp.delete("q");
      usp.delete("page");
      startTransition(() => {
        router.replace(`?${usp.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [q, router]);

  const updateParam = (key: string, value: string | null) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === null || value === "") {
      usp.delete(key);
    } else {
      usp.set(key, value);
    }
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  const togglePromo = () => {
    updateParam("promo", onlyPromo ? null : "1");
  };

  const clearAll = () => {
    setQ("");
    const usp = new URLSearchParams(window.location.search);
    // Mantém `status` (vem das tabs) — limpar só q + categoryId + promo.
    const status = usp.get("status");
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    startTransition(() => {
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    });
  };

  const { roots, childrenByParent } = (() => {
    const rootList = categories.filter((c) => c.parentId === null);
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return { roots: rootList, childrenByParent: map };
  })();

  const hasAny =
    q.trim() !== "" || categoryId !== CATEGORY_ALL || onlyPromo;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative flex-1 sm:max-w-sm">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar por nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 pr-12"
          aria-label="Buscar produtos"
        />
        <kbd
          aria-hidden
          className="border-border bg-muted text-muted-foreground pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[10px] sm:inline-block"
        >
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={categoryId}
          onValueChange={(v) =>
            updateParam("categoryId", v === CATEGORY_ALL ? null : v)
          }
        >
          <SelectTrigger className="h-9 w-full min-w-40 sm:w-auto">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_ALL}>Todas as categorias</SelectItem>
            {roots.map((root) => {
              const children = childrenByParent.get(root.id) ?? [];
              if (children.length === 0) {
                return (
                  <SelectItem key={root.id} value={root.id}>
                    {root.name}
                  </SelectItem>
                );
              }
              return (
                <SelectGroup key={root.id}>
                  <SelectLabel>{root.name}</SelectLabel>
                  <SelectItem value={root.id}>
                    {root.name} (geral)
                  </SelectItem>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {root.name} › {child.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={onlyPromo ? "default" : "outline"}
          size="sm"
          onClick={togglePromo}
          aria-pressed={onlyPromo}
          className={cn("h-9 gap-1.5", onlyPromo && "shadow-brand-sm")}
        >
          <SparklesIcon className="size-4" />
          <span>Em promoção</span>
        </Button>

        {hasAny ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground h-9"
            aria-label="Limpar filtros"
          >
            <XIcon className="size-4" /> Limpar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
