/**
 * CategoryStrip — tile horizontal de categorias.
 *
 * Tematizado (Onda C): aceita prop `shape` controlando o radius dos tiles.
 *   - "rounded" (default — canvas-v1): radius 10px
 *   - "square"  (preset Bazar):        radius 4px (quase reto, sem ser
 *                                       totalmente quadrado pra preservar
 *                                       acabamento profissional)
 *   - "circle"  (preset Boutique):     radius 999px (círculo perfeito)
 *
 * Container: gap 10px, padding-x 16px, scroll horizontal sem barra,
 * snap-mandatory.
 *
 * Server Component — não precisa de hooks ou client interactivity.
 */
import Image from "next/image";
import Link from "next/link";

import type { CategoryNode } from "@/lib/storefront/categories-loader";
import type { CategoryShape } from "@/lib/storefront/themes";
import { cn } from "@/lib/utils";

export interface CategoryStripProps {
  storeSlug: string;
  categories: CategoryNode[];
  /** Eixo de tema. Default "rounded" (canvas-v1). */
  shape?: CategoryShape;
  className?: string;
}

const SHAPE_RADIUS_CLASS: Record<CategoryShape, string> = {
  rounded: "rounded-[10px]",
  square: "rounded-[4px]",
  circle: "rounded-full",
};

export function CategoryStrip({
  storeSlug,
  categories,
  shape = "rounded",
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
            shape={shape}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  category,
  storeSlug,
  shape,
}: {
  category: CategoryNode;
  storeSlug: string;
  shape: CategoryShape;
}) {
  const imageUrl = (category as CategoryNode & { imageUrl?: string | null })
    .imageUrl;
  const initial = category.name.charAt(0).toUpperCase();
  const radiusClass = SHAPE_RADIUS_CLASS[shape];

  return (
    <Link
      href={`/${storeSlug}/categoria/${category.slug}`}
      prefetch={false}
      className="group flex w-[76px] shrink-0 snap-start flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden bg-gray-100 ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-95",
          radiusClass,
        )}
      >
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
