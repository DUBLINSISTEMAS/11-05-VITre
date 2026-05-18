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

import { FilterIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

interface CustomersToolbarProps {
  /** "X – Y de Z" string já calculada server-side. */
  rangeLabel: string;
}

export function CustomersToolbar({ rangeLabel }: CustomersToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
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
          aria-label="Buscar clientes"
        />
      </div>

      <button
        type="button"
        onClick={() => toast.info("Em breve.")}
        className="b3-btn b3-btn--sm"
      >
        <SlidersHorizontalIcon size={13} /> Ordenar
      </button>

      <button
        type="button"
        onClick={() => toast.info("Em breve.")}
        className="b3-btn b3-btn--sm"
      >
        <FilterIcon size={13} /> Filtros
      </button>

      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
