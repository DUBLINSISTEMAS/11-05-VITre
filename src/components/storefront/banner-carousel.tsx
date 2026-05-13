"use client";

/**
 * BannerCarousel — wrapper de HeroCard com rotação automática.
 *
 * Comportamento:
 *  - 1 banner OU rotationSec=0 → renderiza HeroCard único, sem dots,
 *    sem JS de timer (degrada para o estado anterior à Onda B).
 *  - 2+ banners e rotationSec≥3 → autoplay, pause-on-hover (desktop),
 *    pause-on-touch (mobile durante swipe), dots clicáveis, swipe gesture.
 *
 * Transição: crossfade via opacity. Ambas as imagens permanecem montadas
 * (apenas o ativo em z-10) — evita FOUC quando o navegador ainda não
 * cacheou o segundo banner. Sem framer-motion (Vitrê migrou pra CSS).
 *
 * A11y:
 *  - aria-roledescription="carousel" + aria-label na section
 *  - Dots como <button> com aria-current + aria-label "Banner N de M"
 *  - prefers-reduced-motion → autoplay desligado (respeita o usuário)
 *
 * LCP:
 *  - priority só no primeiro banner (LCP slot). Demais carregam lazy.
 *  - Quando autoplay troca, browser já tem cache. Sem layout shift —
 *    container tem aspect-[16/9] fixo herdado do HeroCard.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { ActiveBanner } from "@/lib/storefront/banners-loader";
import type { HeroVariant } from "@/lib/storefront/themes";
import { cn } from "@/lib/utils";

import { HeroCard } from "./hero-card";

interface BannerCarouselProps {
  banners: ActiveBanner[];
  storeSlug: string;
  storeName: string;
  /** Segundos entre cada banner. 0 = desligado. */
  rotationSec: number;
  /** Variant do HeroCard interno (vem de `store.heroStyle`). */
  heroVariant?: HeroVariant;
}

const SWIPE_THRESHOLD_PX = 50;

export function BannerCarousel({
  banners,
  storeSlug,
  storeName,
  rotationSec,
  heroVariant = "cover",
}: BannerCarouselProps) {
  // Caminho rápido: 1 banner ou rotação desligada → HeroCard puro.
  if (banners.length <= 1 || rotationSec === 0) {
    const single = banners[0];
    if (!single) return null;
    return (
      <HeroCard
        banner={single}
        storeSlug={storeSlug}
        storeName={storeName}
        variant={heroVariant}
        priority
      />
    );
  }

  return (
    <CarouselInner
      banners={banners}
      storeSlug={storeSlug}
      storeName={storeName}
      rotationSec={rotationSec}
      heroVariant={heroVariant}
    />
  );
}

function CarouselInner({
  banners,
  storeSlug,
  storeName,
  rotationSec,
  heroVariant = "cover",
}: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = banners.length;
  const touchStartXRef = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      setActiveIndex(((next % total) + total) % total);
    },
    [total],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex]);

  // Autoplay via setInterval — simples e robusto. Cleanup roda a cada
  // mudança de isPaused/rotationSec/total, evitando vazamento.
  //
  // Antes era setTimeout encadeado com `activeIndex` no dep array; o
  // pattern funciona em teoria mas dependia de cada tick agendar o
  // próximo. Qualquer pause-on-touch que não fechasse (ex.: touchend
  // disparado fora do alvo no mobile) deixava o slide parado pra sempre.
  // setInterval fire-and-forget é o padrão Embla/Swiper.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce || isPaused) return;

    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
    }, rotationSec * 1000);

    return () => window.clearInterval(id);
  }, [isPaused, rotationSec, total]);

  // Pause quando aba fica inativa (mais respeitoso com bateria/CPU).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setIsPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) goNext();
    else goPrev();
  };
  // touchcancel pode disparar quando o sistema interrompe o gesto
  // (ex.: notificação cobrindo a tela). Garante reset do ref.
  const onTouchCancel = () => {
    touchStartXRef.current = null;
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`Banners da ${storeName}`}
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {/* Live region anuncia mudança pra screen reader. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Banner {activeIndex + 1} de {total}
      </p>

      <div className="relative">
        {banners.map((banner, idx) => (
          <div
            key={banner.id}
            aria-hidden={idx !== activeIndex}
            className={cn(
              "transition-opacity duration-500 ease-in-out",
              idx === activeIndex
                ? "relative opacity-100"
                : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            <HeroCard
              banner={banner}
              storeSlug={storeSlug}
              storeName={storeName}
              variant={heroVariant}
              priority={idx === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots — focáveis por teclado, com aria-current pra leitores. */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {banners.map((b, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={`Ir para o banner ${idx + 1}`}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                "focus-visible:ring-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isActive
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-foreground/30 hover:bg-foreground/50",
              )}
            />
          );
        })}
      </div>
    </section>
  );
}
