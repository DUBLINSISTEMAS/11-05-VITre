"use client";

/**
 * Galeria de imagens do PDP — fiel ao canvas-v1 (`_vitre-storefront.jsx:246-258`).
 *
 * Layout:
 *   - Imagem principal full-bleed (sem rounded-radius). Aspect-square no
 *     mobile, mantém na desktop (orquestração de full-bleed/padding fica
 *     com `product-detail-view`).
 *   - Carrossel horizontal scroll-snap com IntersectionObserver pra
 *     sincronizar com os dots.
 *   - Dots indicator absolute bottom-3.5 centro:
 *       active   = 18×6 rounded-[3px] bg-foreground (pill expandido)
 *       inactive = 6×6  rounded-[3px] bg-black/25
 *     Transition `width 200ms` ao trocar slide.
 *   - Header (back+search) NÃO está aqui — é responsabilidade do
 *     `<StoreHeader variant="pdp-floating">` orquestrado pelo detail-view.
 *
 * Removido vs versão anterior:
 *   - Thumbnails circulares abaixo da galeria (linhas 124-150 da versão
 *     antiga). Canvas não tem.
 *   - Background overlay com `bg-black/20 backdrop-blur` em volta dos
 *     dots — canvas tem dots flutuando direto sobre a imagem.
 *   - `rounded-3xl bg-gray-50` no container — canvas é borderRadius 0.
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
      <div className="flex aspect-square items-center justify-center bg-gray-100 text-sm text-muted-foreground">
        Sem foto
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Carrossel scroll-snap */}
      <div
        ref={containerRef}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden bg-gray-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      {/* Dots — canvas linhas 254-258 */}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3.5 flex items-center justify-center gap-1.5">
          {images.map((img, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => scrollTo(idx)}
                aria-label={`Ver imagem ${idx + 1} de ${images.length}`}
                className={cn(
                  "h-1.5 rounded-[3px] outline-none transition-[width,background-color] duration-200",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active ? "w-[18px] bg-foreground" : "w-1.5 bg-black/25 hover:bg-black/40",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
