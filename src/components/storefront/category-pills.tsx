"use client";

/**
 * Pills de categorias horizontais - estilo app de moda.
 *
 * Layout: [All] [✨ Dresses] [Jackets] [Jeans] ...
 * - Pills com borda, fundo branco (inativo) ou preto (ativo)
 * - Categoria ativa: fundo preto, texto branco, ícone sparkles
 * - Scroll horizontal com snap
 */
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { cn } from "@/lib/utils";

export interface CategoryPillsProps {
  storeSlug: string;
  categories: CategoryNode[];
}

export function CategoryPills({ storeSlug, categories }: CategoryPillsProps) {
  const pathname = usePathname();

  if (categories.length === 0) return null;

  const match = pathname.match(/\/categoria\/([^/]+)/);
  const activeSlug = match ? match[1] : null;
  const isHome = pathname === `/${storeSlug}` || pathname === `/${storeSlug}/`;

  return (
    <section aria-label="Categorias" className="py-2">
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* All pill */}
        <PillLink href={`/${storeSlug}`} isActive={isHome} prefetch>
          All
        </PillLink>

        {/* Category pills */}
        {categories.map((cat) => {
          const isActive = activeSlug === cat.slug;
          return (
            <PillLink
              key={cat.id}
              href={`/${storeSlug}/categoria/${cat.slug}`}
              isActive={isActive}
            >
              {isActive && <Sparkles className="size-3.5" />}
              {cat.name}
            </PillLink>
          );
        })}
      </div>
    </section>
  );
}

interface PillLinkProps {
  href: string;
  isActive: boolean;
  prefetch?: boolean;
  children: React.ReactNode;
}

function PillLink({ href, isActive, prefetch = false, children }: PillLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className="relative shrink-0 snap-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
    >
      {isActive && (
        <motion.div
          layoutId="category-pill-active"
          className="absolute inset-0 rounded-full bg-foreground"
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
          }}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          isActive
            ? "border-transparent text-background"
            : "border-gray-200 bg-white text-foreground hover:bg-gray-50"
        )}
      >
        {children}
      </span>
    </Link>
  );
}
