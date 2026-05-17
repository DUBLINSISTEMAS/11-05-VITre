"use client";

// StoreSwitcher do canvas-v1 admin: bloco no topo da sidebar com avatar
// (logo da loja, com fallback pra inicial colorida no `primaryColor`) +
// nome + handle monoespaçado. Display-only (não há multi-loja no schema
// ainda) — clica e volta pro dashboard.
import Image from "next/image";
import Link from "next/link";

export interface StoreSwitcherProps {
  storeName: string;
  storeSlug: string;
  /** Cor primária da loja (hex). Usada como background do avatar fallback. */
  primaryColor: string;
  /** URL do logo da loja (Supabase Storage). null = renderiza inicial. */
  logoUrl: string | null;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

export function StoreSwitcher({
  storeName,
  storeSlug,
  primaryColor,
  logoUrl,
}: StoreSwitcherProps) {
  return (
    <Link
      href="/admin"
      prefetch
      className="hocus:bg-bg-app group flex items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`${storeName} — ir para o início`}
    >
      {logoUrl ? (
        // 40x40 com object-contain pra logos com aspect variado (algumas
        // landscape, algumas quadradas). Fundo branco padrão pra contraste
        // com logos transparentes — segue a recomendação 400x200 do
        // helper text do form de configurações.
        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">
          <Image
            src={logoUrl}
            alt=""
            fill
            sizes="40px"
            className="object-contain p-0.5"
          />
        </span>
      ) : (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-base font-semibold text-white shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {getInitial(storeName)}
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold tracking-tight text-ink-1">
          {storeName}
        </span>
        <span className="block truncate font-mono text-[10.5px] text-ink-4">
          @{storeSlug}
        </span>
      </span>
    </Link>
  );
}
