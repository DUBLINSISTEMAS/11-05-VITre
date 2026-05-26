"use client";

// Toolbar Dublin v3 da lista de produtos (port Dublin v3, ADR-0019, Onda A.7).
// Substitui ProductsFilters antigo. URL-driven com debounce 300ms.
//
// Layout `b3-toolbar`:
//   checkbox master (disabled, bulk actions onda futura)
//   `b3-toolbar-search` com SearchIcon + input
//   Select Categoria (shadcn) — substitui Filtros popover (Popover não
//     instalado; manteve inline simples conforme handoff Mangos Pay)
//   button "Ordenar" placeholder (toast)
//   button "Filtros" placeholder (toast — bandeja avançada onda futura)
//   flex spacer
//   counter mono "X – Y de Z"
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CategoryOption } from "./category-dialog";

const CATEGORY_ALL = "__all__";

interface ProductsToolbarProps {
  categories: CategoryOption[];
  /** "X – Y de Z" string já calculada server-side. */
  rangeLabel: string;
}

export function ProductsToolbar({ categories, rangeLabel }: ProductsToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("categoryId") ?? CATEGORY_ALL;
  // Audit 2026-05-26 — sort URL-driven.
  const sort = searchParams.get("sort") ?? "updated-desc";

  const [q, setQ] = useState(initialQ);

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

  const updateCategory = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === CATEGORY_ALL) usp.delete("categoryId");
    else usp.set("categoryId", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  // Audit 2026-05-26 — handler de sort. Default "updated-desc" omite param.
  const updateSort = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === "updated-desc") usp.delete("sort");
    else usp.set("sort", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
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

  return (
    <div className="b3-toolbar">
      {/* Sprint flash 2026-05-24 — checkbox "selecionar tudo" removido
          (estava disabled + "em breve"). Régua "funciona ou esconde":
          controle visível que não faz nada quebra confiança. Quando bulk
          actions (delete/export/categoria em massa) for implementado,
          este checkbox volta junto com a barra de ações que ele controla. */}

      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Procurar registros"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar produtos"
        />
      </div>

      <Select value={categoryId} onValueChange={updateCategory}>
        <SelectTrigger
          className="h-9 min-w-40 max-w-52"
          data-active={categoryId !== CATEGORY_ALL ? "true" : undefined}
        >
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
                <SelectItem value={root.id}>{root.name} (geral)</SelectItem>
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

      {/* Audit 2026-05-26 — botão "Ordenar" REATIVADO com implementação real.
          URL-driven (?sort=). Padrão de stock-snapshot. Default "updated-desc"
          omite o param. */}
      <Select value={sort} onValueChange={updateSort}>
        <SelectTrigger
          className="h-9 min-w-40 max-w-52"
          data-active={sort !== "updated-desc" ? "true" : undefined}
        >
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updated-desc">Mais recentes</SelectItem>
          <SelectItem value="name-asc">Nome (A–Z)</SelectItem>
          <SelectItem value="name-desc">Nome (Z–A)</SelectItem>
          <SelectItem value="price-asc">Preço (menor)</SelectItem>
          <SelectItem value="price-desc">Preço (maior)</SelectItem>
          <SelectItem value="stock-asc">Estoque (menor)</SelectItem>
          <SelectItem value="stock-desc">Estoque (maior)</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
