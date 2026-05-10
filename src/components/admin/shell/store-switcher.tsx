"use client";

// StoreSwitcher do canvas-v1 admin: bloco no topo da sidebar com avatar
// quadrado tingido pela cor da loja + nome + handle monoespaçado.
// Display-only (não há multi-loja no schema ainda) — clica e volta pro
// dashboard.
import Link from "next/link";

export interface StoreSwitcherProps {
  storeName: string;
  storeSlug: string;
  /** Cor primária da loja (hex). Usada como background do avatar. */
  primaryColor: string;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

export function StoreSwitcher({
  storeName,
  storeSlug,
  primaryColor,
}: StoreSwitcherProps) {
  return (
    <Link
      href="/admin"
      prefetch
      className="hocus:bg-accent/60 group flex items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`${storeName} — ir para o início`}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        {getInitial(storeName)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold tracking-tight text-foreground">
          {storeName}
        </span>
        <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
          @{storeSlug}
        </span>
      </span>
    </Link>
  );
}
