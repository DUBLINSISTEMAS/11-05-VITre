/**
 * CollectionStrip — Sprint 5.3 (2026-05-22).
 *
 * Seção "Vitrines" na home da loja. Renderiza cards horizontais com
 * thumbnail (imagem do 1º produto), nome, count de produtos e link
 * pra /[storeSlug]/colecao/[slug] (rota dedicada já existe).
 *
 * Pattern visual: alinhado com `CategoryStrip` — tiles horizontais
 * com scroll suave. Quando o lojista criar 1-3 coleções, todas
 * aparecem; com 4+, scroll horizontal mostra "..." na borda.
 */
import Image from "next/image";
import Link from "next/link";

import type { HomeCollection } from "@/lib/storefront/home-loader";

interface CollectionStripProps {
  storeSlug: string;
  collections: HomeCollection[];
}

export function CollectionStrip({ storeSlug, collections }: CollectionStripProps) {
  if (collections.length === 0) return null;

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-1">
      <ul className="flex gap-3" role="list">
        {collections.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link
              href={`/${storeSlug}/colecao/${c.slug}`}
              prefetch={false}
              className="block w-[140px] outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
                {c.thumbnailUrl ? (
                  <Image
                    src={c.thumbnailUrl}
                    alt={c.name}
                    fill
                    sizes="140px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="text-muted-foreground/40 grid size-full place-items-center text-xs">
                    Sem foto
                  </div>
                )}
              </div>
              <p className="text-foreground mt-1.5 line-clamp-1 text-[12.5px] font-medium">
                {c.name}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {c.productCount} {c.productCount === 1 ? "produto" : "produtos"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
