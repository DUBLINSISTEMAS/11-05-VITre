"use client";

// Toolbar de /admin/orcamentos — Semana 5 da ressignificação.
// 3 abas (Todos / Ativos / Expirados) + busca por código/cliente.
// URL-driven via useSearchParams (mesmo padrão dos demais).

import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

interface OrcamentosToolbarProps {
  tabCounts: { all: number; ativos: number; expirados: number };
  currentValidade: "ativos" | "expirados" | null;
  initialQ: string;
  rangeLabel: string;
}

const TABS: Array<{
  key: "ativos" | "expirados" | null;
  label: string;
  countKey: "all" | "ativos" | "expirados";
}> = [
  { key: "ativos", label: "Ativos", countKey: "ativos" },
  { key: "expirados", label: "Expirados", countKey: "expirados" },
  { key: null, label: "Todos", countKey: "all" },
];

export function OrcamentosToolbar({
  tabCounts,
  currentValidade,
  initialQ,
  rangeLabel,
}: OrcamentosToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
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

  const changeTab = (next: "ativos" | "expirados" | null) => {
    const usp = new URLSearchParams(searchParams.toString());
    if (next === null) usp.delete("validade");
    else usp.set("validade", next);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
      <div className="b3-toolbar-search flex-1 min-w-48">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por cliente ou código"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar orçamentos"
        />
      </div>

      <div
        role="tablist"
        aria-label="Filtro de validade"
        className="flex items-center gap-1 rounded-lg border border-line bg-bg-app/40 p-1"
      >
        {TABS.map((t) => {
          const isActive = currentValidade === t.key;
          const cnt = tabCounts[t.countKey];
          return (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => changeTab(t.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                isActive
                  ? "bg-surface text-ink-1 shadow-sm"
                  : "text-ink-3 hover:bg-bg-app",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  isActive
                    ? "bg-mangos-yellow text-mangos-green-900"
                    : "bg-line/60 text-ink-3",
                )}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
