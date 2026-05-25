"use client";

// Toggle table ↔ grid em /admin/produtos — handoff Passo 9.
//
// URL-driven via `?view=table|grid`. Table é o default (omitir param).
// Persiste no histórico mas não no scroll. Pattern alinhado ao
// EstoqueViewTabs.

import { LayoutGridIcon, ListIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

type View = "table" | "grid";

export function ProductsViewToggle({ current }: { current: View }) {
  const searchParams = useSearchParams();

  const hrefFor = (view: View) => {
    const usp = new URLSearchParams(searchParams.toString());
    usp.delete("page");
    if (view === "table") {
      usp.delete("view");
    } else {
      usp.set("view", view);
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="inline-flex items-center gap-px rounded-lg border border-line bg-bg-app p-0.5"
    >
      <Link
        href={hrefFor("table")}
        replace
        scroll={false}
        prefetch={false}
        aria-pressed={current === "table"}
        aria-label="Visualizar em tabela"
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md transition-colors",
          current === "table"
            ? "bg-surface text-mangos-green-800 shadow-sm"
            : "text-ink-4 hover:text-ink-2",
        )}
        title="Tabela"
      >
        <ListIcon size={14} aria-hidden />
      </Link>
      <Link
        href={hrefFor("grid")}
        replace
        scroll={false}
        prefetch={false}
        aria-pressed={current === "grid"}
        aria-label="Visualizar em grid de cards"
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md transition-colors",
          current === "grid"
            ? "bg-surface text-mangos-green-800 shadow-sm"
            : "text-ink-4 hover:text-ink-2",
        )}
        title="Grid"
      >
        <LayoutGridIcon size={14} aria-hidden />
      </Link>
    </div>
  );
}
