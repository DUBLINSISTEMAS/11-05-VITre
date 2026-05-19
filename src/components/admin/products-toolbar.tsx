"use client";

// Toolbar Dublin v3 da lista de produtos (port Dublin v3, ADR-0019, Onda A.7).
// Substitui ProductsFilters antigo. URL-driven com debounce 300ms.
//
// Layout `b3-toolbar`:
//   checkbox master (disabled, bulk actions onda futura)
//   `b3-toolbar-search` com SearchIcon + input
//   Select Categoria (shadcn) — substitui Filtros popover (Popover não
//     instalado; manteve inline simples conforme handoff Vitrê)
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
      <input
        type="checkbox"
        disabled
        aria-label="Selecionar todos (em breve)"
        className="size-4 cursor-not-allowed opacity-40"
      />

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

      {/* Onda C #12 (auditoria 2026-05-19): botões "Ordenar"/"Filtros"
       * eram toast.info("Em breve") em prod — pior que ausentes (frustra
       * lojista clicando achando que abre filtro). Removidos até ter
       * implementação real. Pattern de URL state já existe em /pedidos
       * (server-rendered + ?status= via Link) — replicar quando voltar. */}

      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
