"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * Filtros da lista de movimentações de estoque (Fase 4 — ADR-0015).
 * URL-driven (convenção CLAUDE.md #11).
 */
export function StockMovementsFilters() {
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

  const clearAll = () => {
    setQ("");
    startTransition(() => {
      router.replace("?", { scroll: false });
    });
  };

  const hasAny = q.trim() !== "" || type !== TYPE_ALL;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative flex-1 sm:max-w-sm">
        <SearchIcon
          aria-hidden
          className="text-ink-4 pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar por nome do produto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
          aria-label="Buscar movimentações por produto"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={updateType}>
          <SelectTrigger className="w-full min-w-44 sm:w-auto">
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

        {hasAny ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-ink-4"
          >
            <XIcon className="size-4" /> Limpar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
