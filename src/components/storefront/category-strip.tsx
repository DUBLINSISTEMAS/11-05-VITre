/**
 * CategoryStrip — fiel ao canvas-referencia (canvas-v1).
 *
 * Tiles quadrados (não círculos) em scroll horizontal. Cada tile:
 *   - 76px wide com aspect-[1/1]
 *   - border-radius 10px (não 999)
 *   - imageUrl quando existe; senão placeholder cinza com inicial
 *   - label centrado embaixo, text-[10.5px] font-medium
 *
 * Container: gap 10px, padding-x 16px, scroll horizontal sem barra,
 * snap-mandatory.
 *
 * Server Component — não precisa de hooks ou client interactivity.
 */
import Image from "next/image";
import Link from "next/link";

import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { cn } from "@/lib/utils";

export interface CategoryStripProps {
  storeSlug: string;
  categories: CategoryNode[];
  className?: string;
}

export function CategoryStrip({
  storeSlug,
  categories,
  className,
}: CategoryStripProps) {
  if (categories.length === 0) return null;

  return (
    <section aria-label="Categorias" className={className}>
      <div
        className={cn(
          "scrollbar-none flex overflow-x-auto pb-1",
          "snap-x snap-mandatory",
          // gap 10px, padding-x 16 (canvas)
          "-mx-4 gap-2.5 px-4",
        )}
      >
        {categories.map((cat) => (
          <CategoryTile
            key={cat.id}
            category={cat}
            storeSlug={storeSlug}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  category,
  storeSlug,
}: {
  category: CategoryNode;
  storeSlug: string;
}) {
  const imageUrl = (category as CategoryNode & { imageUrl?: string | null })
    .imageUrl;
  const initial = category.name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/${storeSlug}/categoria/${category.slug}`}
      prefetch={false}
      className="group flex w-[76px] shrink-0 snap-start flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-gray-100 ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-95">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="76px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-base font-medium text-muted-foreground">
            {initial}
          </div>
        )}
      </div>
      <span className="line-clamp-1 text-center text-[10.5px] font-medium leading-tight text-foreground transition-colors group-hover:text-brand-store">
        {category.name}
      </span>
    </Link>
  );
}
