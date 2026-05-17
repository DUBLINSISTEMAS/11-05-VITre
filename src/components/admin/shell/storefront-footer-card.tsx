"use client";

// Card "SEU STOREFRONT" no rodapé da sidebar (port Dublin v3, Onda 5a).
// Mostra a URL pública da loja com tipografia monospace + botão "Abrir
// vitrine ↗" que abre o storefront em nova aba.
import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

export interface StorefrontFooterCardProps {
  storeSlug: string;
}

export function StorefrontFooterCard({ storeSlug }: StorefrontFooterCardProps) {
  return (
    <div className="b3-card flex flex-col gap-2 rounded-lg p-3">
      <span className="text-eyebrow">Seu storefront</span>
      <span className="truncate font-mono text-[11.5px] text-ink-2">
        vitre.site/{storeSlug}
      </span>
      <Link
        href={`/${storeSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hocus:bg-bg-app inline-flex h-7 w-fit items-center gap-1 rounded-md border border-line px-2 text-[11.5px] font-medium text-ink-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Abrir vitrine
        <ArrowUpRightIcon className="size-3" aria-hidden />
      </Link>
    </div>
  );
}
