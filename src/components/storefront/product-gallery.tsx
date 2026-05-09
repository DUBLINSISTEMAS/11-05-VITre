"use client";

/**
 * Galeria de imagens redesign - estilo app de moda premium.
 *
 * Features:
 * - Imagem principal grande com navegação via dots
 * - Thumbnails circulares para cores/variantes
 * - Navegação suave com intersection observer
 */
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProductImage } from "@/db/schema";
import { cn } from "@/lib/utils";

export interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || images.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.slideIndex,
            );
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
  }, [images.length]);

  const scrollTo = useCallback((idx: number) => {
    const slide = slideRefs.current[idx];
    if (slide) {
      slide.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
    }
    setActiveIndex(idx);
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl bg-gray-100 text-sm text-muted-foreground">
        Sem foto
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main image carousel */}
      <div className="relative">
        <div
          ref={containerRef}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-3xl bg-gray-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carrossel"
          aria-label={`Imagens de ${productName}`}
        >
          {images.map((img, idx) => (
            <figure
              key={img.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-slide-index={idx}
              className="relative aspect-square w-full shrink-0 snap-start"
            >
              <Image
                src={img.url}
                alt={img.alt ?? productName}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={idx === 0}
                className="h-auto w-full object-cover"
              />
            </figure>
          ))}
        </div>

        {/* Dots indicator overlay */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => scrollTo(idx)}
                className={cn(
                  "rounded-full transition-all duration-300 outline-none",
                  idx === activeIndex
                    ? "bg-white w-4 h-1.5"
                    : "bg-white/50 hover:bg-white/70 w-1.5 h-1.5",
                )}
                aria-label={`Ver imagem ${idx + 1} de ${images.length}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Circular thumbnails */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-5 lg:px-0">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => scrollTo(idx)}
              className={cn(
                "relative size-12 overflow-hidden rounded-full outline-none transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                idx === activeIndex
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "opacity-60 hover:opacity-100",
              )}
              aria-label={`Ver imagem ${idx + 1} de ${images.length}`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
