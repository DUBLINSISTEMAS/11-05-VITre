"use client";

/**
 * Banner carousel redesign - estilo app de moda premium.
 *
 * Features:
 * - Design dark com texto branco e destaque na cor da loja (--brand-store)
 * - Bordas muito arredondadas (rounded-3xl)
 * - Dots indicadores estilizados
 * - Auto-advance com pause on hover
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Banner } from "@/db/schema";
import { cn } from "@/lib/utils";

export interface BannerCarouselProps {
  banners: Banner[];
}

const AUTO_ADVANCE_INTERVAL = 5000;

export function BannerCarousel({ banners }: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);

  // Auto-advance
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, AUTO_ADVANCE_INTERVAL);

    return () => clearInterval(timer);
  }, [banners.length, isPaused]);

  // Scroll to active slide
  useEffect(() => {
    const slide = slideRefs.current[activeIndex];
    if (slide) {
      slide.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
    }
  }, [activeIndex]);

  // Intersection observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || banners.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.slideIndex);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );

    for (const slide of slideRefs.current) {
      if (slide) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [banners.length]);

  const goTo = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  if (banners.length === 0) {
    // Show placeholder promo banner
    return <PlaceholderBanner />;
  }

  if (banners.length === 1) {
    return <BannerSlide banner={banners[0]} priority index={0} total={1} />;
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={containerRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Banners promocionais"
      >
        {banners.map((banner, idx) => (
          <div
            key={banner.id}
            ref={(el) => {
              slideRefs.current[idx] = el;
            }}
            data-slide-index={idx}
            className="w-full shrink-0 snap-start"
          >
            <BannerSlide
              banner={banner}
              priority={idx === 0}
              index={idx}
              total={banners.length}
            />
          </div>
        ))}
      </div>

      {/* Navigation arrows - desktop only */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hidden md:flex"
        aria-label="Banner anterior"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hidden md:flex"
        aria-label="Proximo banner"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Dots indicator - styled */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1"
        role="tablist"
        aria-label="Selecionar banner"
      >
        {banners.map((banner, idx) => (
          <button
            key={banner.id}
            type="button"
            role="tab"
            aria-selected={idx === activeIndex}
            aria-label={`Ir para banner ${idx + 1}`}
            onClick={() => goTo(idx)}
            className={cn(
              "rounded-full transition-all duration-300 outline-none",
              idx === activeIndex
                ? "bg-white w-4 h-1.5"
                : "bg-white/40 hover:bg-white/60 w-1.5 h-1.5",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function BannerSlide({
  banner,
  priority,
  index,
  total,
}: {
  banner: Banner;
  priority: boolean;
  index: number;
  total: number;
}) {
  const content = (
    <div className="relative aspect-[2/1] sm:aspect-[2.5/1] overflow-hidden rounded-3xl bg-gray-900">
      <Image
        src={banner.imageUrl}
        alt=""
        fill
        sizes="(max-width: 1280px) 100vw, 1280px"
        priority={priority}
        className="object-cover"
      />
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
    </div>
  );

  if (banner.link) {
    const ariaLabel =
      total > 1
        ? `Banner ${index + 1} de ${total}`
        : "Banner promocional";
    return (
      <Link
        href={banner.link}
        prefetch={false}
        aria-label={ariaLabel}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-3xl"
      >
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Placeholder banner when no banners exist.
 * Shows a promo-style dark banner with brand-store accent (cor da loja).
 */
function PlaceholderBanner() {
  return (
    <div className="relative aspect-[2/1] sm:aspect-[2.5/1] overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Decorative elements - cor da loja */}
      <div className="absolute -right-20 -top-20 size-80 rounded-full bg-brand-store/15 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 size-60 rounded-full bg-brand-store/10 blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-center px-6 sm:px-10">
        <p className="text-xs sm:text-sm font-medium text-brand-store mb-1">
          Super Oferta
        </p>
        <h2 className="text-xl sm:text-3xl font-bold text-white mb-1">
          Desconto
        </h2>
        <p className="flex items-baseline gap-2 mb-4">
          <span className="text-sm sm:text-base text-white/80">Até</span>
          <span className="text-2xl sm:text-4xl font-bold text-brand-store">50%</span>
        </p>
        <button
          type="button"
          className="w-fit rounded-lg bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-gray-900 transition-transform hover:scale-105 active:scale-95"
        >
          Comprar Agora
        </button>
      </div>

      {/* Dots placeholder */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
        <span className="bg-white w-4 h-1.5 rounded-full" />
        <span className="bg-white/40 w-1.5 h-1.5 rounded-full" />
        <span className="bg-white/40 w-1.5 h-1.5 rounded-full" />
        <span className="bg-white/40 w-1.5 h-1.5 rounded-full" />
      </div>
    </div>
  );
}
