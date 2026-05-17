"use client";

// Tabs de status da lista de produtos (canvas-v1 admin Lote 3 — substitui
// o Select de status do ProductsFilters). URL-driven (`?status=...`).
//
// 5 abas: Todos / Visíveis / Pausados / Rascunhos / Sem estoque.
// Canvas mostra 4 (Todos/Ativos/Rascunhos/Sem estoque) — adicionei
// "Pausados" pra preservar UX atual sem regressão.
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { value: null, label: "Todos", countKey: "all" },
  { value: "active", label: "Visíveis", countKey: "active" },
  { value: "inactive", label: "Pausados", countKey: "inactive" },
  { value: "draft", label: "Rascunhos", countKey: "draft" },
  { value: "no-stock", label: "Sem estoque", countKey: "no-stock" },
] as const;

export type ProductStatusFilter =
  | "active"
  | "inactive"
  | "draft"
  | "no-stock";

export interface ProductsStatusTabsCounts {
  all: number;
  active: number;
  inactive: number;
  draft: number;
  "no-stock": number;
}

interface ProductsStatusTabsProps {
  counts: ProductsStatusTabsCounts;
}

export function ProductsStatusTabs({ counts }: ProductsStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("status");

  const handleSelect = (value: string | null) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === null) usp.delete("status");
    else usp.set("status", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Filtrar por status"
      className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 sm:gap-1.5"
    >
      {TABS.map((tab) => {
        const isActive = (tab.value ?? null) === (current ?? null);
        const count = counts[tab.countKey];
        return (
          <button
            key={tab.label}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => handleSelect(tab.value)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "bg-brand text-white"
                : "text-ink-3 hocus:bg-bg-app hocus:text-ink-1",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 font-mono text-[11px] tabular-nums",
                isActive ? "opacity-80" : "opacity-60",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
