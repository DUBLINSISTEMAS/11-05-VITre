import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Recebe `page` (1-indexed) e devolve string `?...` pra navegação. */
  buildHref: (page: number) => string;
  className?: string;
}

/**
 * Paginação minimalista pra listas server-rendered. Render zero quando
 * só tem 1 página. `Link` com prefetch pra próxima página — mesmo padrão
 * adotado nas demais navegações do admin.
 */
export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        "flex items-center justify-between gap-3 border-t pt-4",
        className,
      )}
    >
      <PageLink
        href={buildHref(currentPage - 1)}
        disabled={!hasPrev}
        rel="prev"
        ariaLabel="Página anterior"
      >
        <ChevronLeftIcon className="size-4" />
        <span className="hidden sm:inline">Anterior</span>
      </PageLink>

      <p className="text-muted-foreground text-sm">
        Página <span className="text-foreground font-medium">{currentPage}</span>{" "}
        de {totalPages}
      </p>

      <PageLink
        href={buildHref(currentPage + 1)}
        disabled={!hasNext}
        rel="next"
        ariaLabel="Próxima página"
      >
        <span className="hidden sm:inline">Próxima</span>
        <ChevronRightIcon className="size-4" />
      </PageLink>
    </nav>
  );
}

interface PageLinkProps {
  href: string;
  disabled: boolean;
  rel: "prev" | "next";
  ariaLabel: string;
  children: React.ReactNode;
}

function PageLink({ href, disabled, rel, ariaLabel, children }: PageLinkProps) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled aria-label={ariaLabel}>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} prefetch rel={rel} aria-label={ariaLabel}>
        {children}
      </Link>
    </Button>
  );
}
