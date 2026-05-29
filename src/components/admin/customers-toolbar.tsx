"use client";

// Toolbar Dublin v3 da lista de clientes (port Dublin v3, ADR-0019, Onda A.9).
// Substitui CustomersFilters antigo. URL-driven com debounce 300ms.
//
// Layout `b3-toolbar`:
//   checkbox master (disabled, bulk actions onda futura)
//   `b3-toolbar-search` com SearchIcon + input "Procurar registros"
//   button "Ordenar" placeholder (toast)
//   button "Filtros" placeholder (toast — bandeja avançada onda futura)
//   flex spacer
//   counter mono "X – Y de Z"
//
// Decisões pixel-perfect vs handoff:
// - Handoff (B3ClientesScreen) tem botão "Salvar filtro" entre search e
//   Ordenar — OMITIDO porque depende de bandeja de filtros avançados
//   que não existe ainda. Quando filtros forem reais, voltamos.
// - Handoff tem checkbox master + refresh button — checkbox preservado
//   disabled; refresh OMITIDO (não há ação clara fora da page reload).

import { ArrowDownUpIcon, SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CustomersToolbarProps {
  /** "X – Y de Z" string já calculada server-side. */
  rangeLabel: string;
}

type TypeFilter = "all" | "individual" | "company";
type SortValue = "recent" | "name" | "orders" | "fiado" | "last-purchase";

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome (A → Z)" },
  { value: "orders", label: "Mais pedidos" },
  { value: "fiado", label: "Maior fiado" },
  { value: "last-purchase", label: "Última compra" },
];

export function CustomersToolbar({ rangeLabel }: CustomersToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);

  // ADR-0021 — filtro PF/PJ. URL-driven, sem state local (instant nav).
  const currentType: TypeFilter =
    searchParams.get("type") === "individual"
      ? "individual"
      : searchParams.get("type") === "company"
        ? "company"
        : "all";

  const setTypeFilter = (next: TypeFilter) => {
    const usp = new URLSearchParams(window.location.search);
    if (next === "all") usp.delete("type");
    else usp.set("type", next);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  // Bloco I.3 (2026-05-29) — ordenação URL-driven; default omite o param.
  const rawSort = searchParams.get("sort");
  const currentSort: SortValue = SORT_OPTIONS.find(
    (o) => o.value === rawSort,
  )?.value ?? "recent";

  const setSort = (next: SortValue) => {
    const usp = new URLSearchParams(window.location.search);
    if (next === "recent") usp.delete("sort");
    else usp.set("sort", next);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

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

  return (
    <div className="b3-toolbar">
      {/* Sprint flash 2026-05-24 — checkbox "selecionar tudo" removido
          (estava disabled + "em breve"). Régua "funciona ou esconde". */}

      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Procurar registros"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar clientes"
        />
      </div>

      {/* ADR-0021 — chips PF/PJ. URL-driven. */}
      <div
        role="group"
        aria-label="Filtrar por tipo"
        className="border-line inline-flex rounded-[8px] border p-0.5"
      >
        {(
          [
            { v: "all" as const, label: "Todos" },
            { v: "individual" as const, label: "PF" },
            { v: "company" as const, label: "PJ" },
          ] as const
        ).map((opt) => {
          const active = currentType === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              aria-pressed={active}
              onClick={() => setTypeFilter(opt.v)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition",
                active
                  ? "bg-surface text-ink-1 shadow-sm"
                  : "text-ink-3 hover:text-ink-1",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Bloco I.3 (2026-05-29) — Select de ordenação URL-driven (sort=). */}
      <Select value={currentSort} onValueChange={(v) => setSort(v as SortValue)}>
        <SelectTrigger className="h-8 min-w-[170px]" aria-label="Ordenar por">
          <ArrowDownUpIcon className="size-3.5" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
