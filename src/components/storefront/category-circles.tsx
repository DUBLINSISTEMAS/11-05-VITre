"use client";

/**
 * Faixa de categorias em círculos.
 *
 * Estética: circulinhos size-12 com imagem dentro (ou inicial fallback)
 * e nome compacto embaixo. Scroll horizontal mobile-friendly. O círculo
 * "Todos" abre o root da loja; cada categoria abre /categoria/[slug].
 * Indicador de ativo via ring na borda do círculo.
 */
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { cn } from "@/lib/utils";

export interface CategoryCirclesProps {
  storeSlug: string;
  categories: CategoryNode[];
}

export function CategoryCircles({
  storeSlug,
  categories,
}: CategoryCirclesProps) {
  const pathname = usePathname();

  if (categories.length === 0) return null;

  const match = pathname.match(/\/categoria\/([^/]+)/);
  const activeSlug = match ? match[1] : null;
  const isHome = pathname === `/${storeSlug}` || pathname === `/${storeSlug}/`;

  return (
    <section aria-label="Categorias" className="py-1.5">
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`/${storeSlug}`}
          prefetch
          className="group flex shrink-0 snap-start flex-col items-center gap-1.5 outline-none"
        >
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full transition-all duration-200",
              isHome
                ? "bg-primary shadow-sm"
                : "bg-muted group-hover:bg-muted/80",
            )}
          >
            <svg
              className={cn(
                "size-5 transition-colors",
                isHome ? "text-primary-foreground" : "text-muted-foreground",
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <span
            className={cn(
              "max-w-14 truncate text-center text-[10px] font-medium transition-colors",
              isHome ? "text-primary" : "text-muted-foreground",
            )}
          >
            Todos
          </span>
        </Link>

        {categories.map((cat) => {
          const isActive = activeSlug === cat.slug;
          return (
            <Link
              key={cat.id}
              href={`/${storeSlug}/categoria/${cat.slug}`}
              prefetch={false}
              className="group flex shrink-0 snap-start flex-col items-center gap-1.5 outline-none"
            >
              <div
                className={cn(
                  "size-12 overflow-hidden rounded-full transition-all duration-200",
                  isActive
                    ? "ring-2 ring-primary ring-offset-1"
                    : "group-hover:opacity-80",
                )}
              >
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex size-full items-center justify-center transition-colors",
                      isActive
                        ? "bg-primary"
                        : "bg-muted group-hover:bg-muted/80",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {cat.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "max-w-14 truncate text-center text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
