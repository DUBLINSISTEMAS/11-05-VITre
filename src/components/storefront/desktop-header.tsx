"use client";

/**
 * DesktopHeader — header horizontal estilo Shopify Dawn / Nuvemshop Atlántico.
 *
 * Layout (desktop ≥1024px):
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ [logo] Nome    Início · Cat1 · Cat2 · Sobre   [🔍 ♥ 🛍 (3)] │
 *  └──────────────────────────────────────────────────────────────┘
 *
 * Comportamento:
 *  - Sticky top-0, z-30. Colapsa h-20 → h-14 quando scroll > 100px.
 *  - Quando categorias > 4: dropdown "Categorias" no centro.
 *  - Ícone sacola usa `useSacolaDrawerTrigger()` (drawer compartilhado
 *    com mobile). Badge mono mostra `count` do useCart.
 *  - Buscar é Link pra /buscar (não dropdown — match com mobile).
 *  - Favoritos é Link pra /favoritos.
 *
 * Renderizado em paralelo a `StoreHeader` (mobile), com classes
 * `hidden lg:block` e `block lg:hidden` no shell-content. Bottom-nav
 * é escondido em desktop via `lg:hidden`.
 */
import {
  ChevronDownIcon,
  Heart,
  Search,
  ShoppingBag,
  Store as StoreIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useSacolaDrawerTrigger } from "@/components/storefront/sacola-drawer";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { cn } from "@/lib/utils";

export interface DesktopHeaderProps {
  store: Store;
  categories: CategoryNode[];
}

const INLINE_MAX = 4; // categorias inline; acima vira dropdown.

export function DesktopHeader({ store, categories }: DesktopHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 100);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const baseHref = `/${store.slug}`;
  const activeCats = categories.filter((c) => c.isActive);

  return (
    <header
      className={cn(
        "bg-background border-border sticky top-0 z-30 hidden border-b transition-all lg:block",
        scrolled ? "h-14" : "h-20",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-full w-full max-w-screen-xl items-center gap-8 px-8",
        )}
      >
        {/* Logo + nome (esquerda) */}
        <Link
          href={baseHref}
          prefetch
          className="flex shrink-0 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          aria-label={`Início — ${store.name}`}
        >
          {store.logoUrl ? (
            <span
              aria-hidden
              className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-lg"
            >
              <Image
                src={store.logoUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="bg-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-background"
            >
              <StoreIcon className="size-5" strokeWidth={1.6} />
            </span>
          )}
          <span
            className={cn(
              "font-semibold tracking-[-0.3px] text-foreground transition-all",
              scrolled ? "text-base" : "text-lg",
            )}
          >
            {store.name}
          </span>
        </Link>

        {/* Categorias inline (centro) */}
        <nav className="flex flex-1 items-center gap-6">
          <NavLink href={baseHref}>Início</NavLink>
          {activeCats.length <= INLINE_MAX ? (
            activeCats.map((c) => (
              <NavLink
                key={c.id}
                href={`${baseHref}/categoria/${c.slug}`}
              >
                {c.name}
              </NavLink>
            ))
          ) : (
            <CategoriesDropdown
              storeSlug={store.slug}
              categories={activeCats}
            />
          )}
          <NavLink href={`${baseHref}/sobre`}>Sobre</NavLink>
        </nav>

        {/* Ícones de utilidade (direita) */}
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            asLink
            href={`${baseHref}/buscar`}
            ariaLabel="Buscar produtos"
          >
            <Search className="size-5" strokeWidth={1.6} />
          </IconButton>
          <IconButton
            asLink
            href={`${baseHref}/favoritos`}
            ariaLabel="Favoritos"
          >
            <Heart className="size-5" strokeWidth={1.6} />
          </IconButton>
          <SacolaButtonDesktop />
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────── sub-components ─────────────────────── */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="text-foreground hocus:text-foreground/70 text-sm font-medium tracking-[-0.2px] outline-none transition-colors focus-visible:underline"
    >
      {children}
    </Link>
  );
}

interface IconButtonBaseProps {
  ariaLabel: string;
  children: React.ReactNode;
}
type IconButtonProps =
  | (IconButtonBaseProps & { asLink: true; href: string; onClick?: never })
  | (IconButtonBaseProps & { asLink?: false; onClick: () => void; href?: never });

function IconButton(props: IconButtonProps) {
  const className =
    "text-foreground hocus:bg-muted relative inline-flex size-10 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
  if (props.asLink) {
    return (
      <Link
        href={props.href}
        prefetch={false}
        aria-label={props.ariaLabel}
        className={className}
      >
        {props.children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      className={className}
    >
      {props.children}
    </button>
  );
}

function SacolaButtonDesktop() {
  const drawer = useSacolaDrawerTrigger();
  const { count, isHydrated } = useCart();

  return (
    <button
      type="button"
      onClick={drawer.open}
      aria-label={
        count > 0
          ? `Sacola com ${count} ${count === 1 ? "item" : "itens"}`
          : "Sacola"
      }
      className="text-foreground hocus:bg-muted relative inline-flex size-10 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ShoppingBag className="size-5" strokeWidth={1.6} />
      {isHydrated && count > 0 ? (
        <span
          aria-hidden
          className="bg-foreground text-background absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

function CategoriesDropdown({
  storeSlug,
  categories,
}: {
  storeSlug: string;
  categories: CategoryNode[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-foreground hocus:text-foreground/70 inline-flex items-center gap-1 text-sm font-medium tracking-[-0.2px] outline-none focus-visible:underline"
      >
        Categorias
        <ChevronDownIcon className="size-3.5" strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          className="bg-background border-border absolute left-0 top-full z-30 mt-2 min-w-56 rounded-lg border p-2 shadow-md"
        >
          <ul className="space-y-0.5">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${storeSlug}/categoria/${c.slug}`}
                  className="text-foreground hocus:bg-muted block rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setOpen(false)}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
