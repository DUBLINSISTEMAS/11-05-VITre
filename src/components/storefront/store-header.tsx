"use client";

/**
 * StoreHeader — fiel ao canvas-referencia (VTAppBar).
 *
 * 4 variants pixel-a-pixel ao canvas-extracted/_vitre-storefront.jsx:
 *
 *   home          — VTHome (linha ~95-115).      Avatar + nome + handle + buscar.
 *   pdp-floating  — VTPDP (linha ~249-252).      Absolute sobre galeria, 36×36 round + blur.
 *   sticky-title  — VTSacola (linha ~374-378).   Sticky bg-bg + back + title + counter.
 *   category      — VTCategoria (linha ~524-532). Sticky bg-bg + back 32 + kicker/title + counter.
 *
 * Padding-top 54px do canvas é compensação de status-bar iOS — no web
 * usamos valores menores direto. Botões "voltar" usam router.back() com
 * fallback opcional via prop `backHref` (SSR-safe pra cold-loads).
 */
import { ArrowLeft, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Store } from "@/db/schema";

type HomeProps = {
  variant?: "home";
  store: Store;
};

type PdpFloatingProps = {
  variant: "pdp-floating";
  store: Store;
  /** Fallback se window.history vazio. Default: /{storeSlug}. */
  backHref?: string;
};

type StickyTitleProps = {
  variant: "sticky-title";
  store: Store;
  title: string;
  /** Ex: "2 ITENS". */
  counter?: string;
  backHref?: string;
};

type CategoryProps = {
  variant: "category";
  store: Store;
  /** Ex: "CATEGORIA". */
  kicker?: string;
  title: string;
  /** Ex: "14 PEÇAS". */
  counter?: string;
  backHref?: string;
};

export type StoreHeaderProps =
  | HomeProps
  | PdpFloatingProps
  | StickyTitleProps
  | CategoryProps;

export function StoreHeader(props: StoreHeaderProps) {
  const variant = props.variant ?? "home";
  if (variant === "home") return <HomeVariant store={props.store} />;
  if (variant === "pdp-floating") return <PdpFloatingVariant {...(props as PdpFloatingProps)} />;
  if (variant === "sticky-title") return <StickyTitleVariant {...(props as StickyTitleProps)} />;
  return <CategoryVariant {...(props as CategoryProps)} />;
}

/* ─────────────────────────── home ─────────────────────────── */

function HomeVariant({ store }: { store: Store }) {
  const baseHref = `/${store.slug}`;
  const initial = store.name.charAt(0).toUpperCase();
  const handle = store.instagramHandle ?? store.slug;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-3">
        <Link
          href={baseHref}
          prefetch
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Início — ${store.name}`}
        >
          {store.logoUrl ? (
            <span
              aria-hidden
              className="relative inline-block size-8 shrink-0 overflow-hidden rounded-lg bg-muted"
            >
              <Image
                src={store.logoUrl}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[14px] font-semibold tracking-[-0.4px] text-white"
              style={{ background: store.primaryColor }}
            >
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-[1.1] tracking-[-0.3px] text-foreground">
              {store.name}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-500">
              @{handle}
            </span>
          </span>
        </Link>

        <Link
          href={`${baseHref}/buscar`}
          prefetch={false}
          aria-label="Buscar produtos"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-5" strokeWidth={1.6} />
        </Link>
      </div>
    </header>
  );
}

/* ───────────────────── pdp-floating ───────────────────── */

function PdpFloatingVariant({ store, backHref }: PdpFloatingProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between">
      <BackButton size={36} fallback={fallback} className="pointer-events-auto" floating />
      <Link
        href={`/${store.slug}/buscar`}
        prefetch={false}
        aria-label="Buscar produtos"
        className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border-0 bg-white/85 text-foreground backdrop-blur-md outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-5" strokeWidth={1.6} />
      </Link>
    </div>
  );
}

/* ───────────────────── sticky-title ───────────────────── */

function StickyTitleVariant({ store, title, counter, backHref }: StickyTitleProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 py-3">
        <BackButton size={36} fallback={fallback} />
        <span className="min-w-0 flex-1 truncate text-[18px] font-semibold leading-tight tracking-[-0.4px] text-foreground">
          {title}
        </span>
        {counter ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.5px] text-gray-500">
            {counter}
          </span>
        ) : null}
      </div>
    </header>
  );
}

/* ─────────────────────── category ─────────────────────── */

function CategoryVariant({ store, kicker, title, counter, backHref }: CategoryProps) {
  const fallback = backHref ?? `/${store.slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-2.5 px-4 pt-3 pb-2.5">
        <BackButton size={32} fallback={fallback} />
        <span className="min-w-0 flex-1">
          {kicker ? (
            <span className="block font-mono text-[9.5px] uppercase leading-none tracking-[0.5px] text-gray-500">
              {kicker}
            </span>
          ) : null}
          <span className="mt-1 block truncate text-[18px] font-semibold leading-[1.1] tracking-[-0.4px] text-foreground">
            {title}
          </span>
        </span>
        {counter ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.5px] text-gray-500">
            {counter}
          </span>
        ) : null}
      </div>
    </header>
  );
}

/* ─────────────────────── back button ─────────────────────── */

function BackButton({
  size,
  fallback,
  className = "",
  floating = false,
}: {
  size: 32 | 36;
  fallback: string;
  className?: string;
  floating?: boolean;
}) {
  const router = useRouter();
  const sizeClass = size === 36 ? "size-9" : "size-8";

  // Floating variant (PDP): white blur background sobre imagem.
  // Default: sólido bg-muted dentro de header opaco.
  const visualClass = floating
    ? "bg-white/85 text-foreground backdrop-blur-md hover:bg-white"
    : "bg-muted text-foreground hover:bg-gray-200";

  function onClick() {
    // Tenta voltar; cai no fallback se não houver histórico (cold-load,
    // share link). `window.history.length > 1` não é 100% confiável (sempre
    // ≥1) mas Next mantém referrer interno suficiente pra UX comum.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voltar"
      className={`inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full border-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${visualClass} ${className}`}
    >
      <ArrowLeft className={size === 36 ? "size-5" : "size-4"} strokeWidth={1.8} />
    </button>
  );
}
