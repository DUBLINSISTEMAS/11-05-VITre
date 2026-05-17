"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Filtros da lista de clientes (Fase 3 — ADR-0014).
 *
 * URL-driven (convenção CLAUDE.md #11) — busca debounced 300ms em
 * `?q=`, page reset ao mudar query. Match server-side cobre nome
 * (ilike substring) E telefone (ilike substring).
 */
export function CustomersFilters() {
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

  const clearAll = () => {
    setQ("");
    startTransition(() => {
      router.replace("?", { scroll: false });
    });
  };

  const hasAny = q.trim() !== "";

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
          placeholder="Buscar por nome ou telefone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
          aria-label="Buscar clientes"
        />
      </div>

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
  );
}
