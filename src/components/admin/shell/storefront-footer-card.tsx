"use client";

// Card "SEU STOREFRONT" no rodapé da sidebar (canvas-v1 admin). Mostra a
// URL pública da loja com tipografia monospace + botão "Abrir loja ↗"
// que abre o storefront em nova aba.
import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

export interface StorefrontFooterCardProps {
  storeSlug: string;
}

export function StorefrontFooterCard({ storeSlug }: StorefrontFooterCardProps) {
  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-eyebrow">Seu storefront</span>
      <span className="truncate font-mono text-[11.5px] text-foreground/80">
        vitre.app/{storeSlug}
      </span>
      <Link
        href={`/${storeSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hocus:bg-accent inline-flex h-7 w-fit items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Abrir loja
        <ArrowUpRightIcon className="size-3" aria-hidden />
      </Link>
    </div>
  );
}
