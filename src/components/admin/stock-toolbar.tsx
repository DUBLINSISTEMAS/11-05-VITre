"use client";

// Toolbar Dublin v3 da lista de movimentações de estoque (port Dublin v3,
// ADR-0019, Onda A.10). Substitui StockMovementsFilters antigo.
//
// Layout `b3-toolbar`:
//   checkbox master (disabled)
//   `b3-toolbar-search` busca debounced 300ms
//   Select Tipo de movimentação (shadcn — substitui o select solto da
//     filters antiga; mantém valor crítico inline em vez de placeholder)
//   button "Ordenar" placeholder (ordem fixa createdAt desc por enquanto)
//   button "Filtros" placeholder (toast)
//   flex spacer
//   counter mono "X – Y de Z"

import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_ALL = "__all__";

const TYPE_OPTIONS = [
  { value: TYPE_ALL, label: "Todos os tipos" },
  { value: "initial", label: "Saldo inicial" },
  { value: "manual_in", label: "Entrada manual" },
  { value: "manual_out", label: "Saída manual" },
  { value: "sale", label: "Venda" },
  { value: "return", label: "Devolução" },
  { value: "adjustment", label: "Ajuste" },
];

interface StockToolbarProps {
  /** "X – Y de Z" já calculada server-side. */
  rangeLabel: string;
}

export function StockToolbar({ rangeLabel }: StockToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? TYPE_ALL;

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

  const updateType = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === TYPE_ALL) usp.delete("type");
    else usp.set("type", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

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
          placeholder="Procurar por nome do produto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar movimentações de estoque"
        />
      </div>

      <Select value={type} onValueChange={updateType}>
        <SelectTrigger
          className="h-9 min-w-40 max-w-52"
          data-active={type !== TYPE_ALL ? "true" : undefined}
        >
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Onda C #12 (auditoria 2026-05-19): "Em breve" buttons removidos. */}
      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
