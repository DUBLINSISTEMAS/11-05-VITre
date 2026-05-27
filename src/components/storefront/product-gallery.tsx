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
  /**
   * Imagem a ser destacada (rolada para o slide visível). Quando muda,
   * a galeria scrolla pra essa foto. Usado pela seleção de variante
   * no PDP (Onda 4 — Shopify-style featured image por variant).
   */
  activeFeaturedImageId?: string | null;
}

export function ProductGallery({
  images,
  productName,
  activeFeaturedImageId,
}: ProductGalleryProps) {
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

  // Onda 4: quando a variante selecionada tem `featuredImageId`, rola a
  // galeria pra essa foto. activeFeaturedImageId=null não dispara (mantém
  // a foto atual em vez de voltar ao slide 0).
  useEffect(() => {
    if (!activeFeaturedImageId) return;
    const idx = images.findIndex((img) => img.id === activeFeaturedImageId);
    if (idx < 0 || idx === activeIndex) return;
    scrollTo(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeaturedImageId, images]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-gray-100 text-sm text-muted-foreground">
        Sem foto
      </div>
    );
  }

  return (
    // Mobile: galeria simples em coluna única (scroll horizontal + dots).
    // Desktop ≥lg: coluna de thumbnails verticais à esquerda + imagem
    // principal grande à direita. Premium feel estilo Aritzia/Zara —
    // cliente vê todas as fotos de relance e troca com click sem swipe.
    <div className="relative lg:flex lg:gap-3">
      {/* Thumbnails verticais — desktop only.
          Justificativa UX (Fitts): em desktop o cursor é preciso, então
          alvo de 64px é confortável. Mobile usa scroll natural do dedo
          que é mais ergonômico que tap em thumbs pequenas. */}
      {images.length > 1 && (
        <div
          className="hidden flex-col gap-2 lg:flex lg:w-[68px] lg:shrink-0"
          role="tablist"
          aria-label={`Miniaturas de ${productName}`}
        >
          {images.map((img, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => scrollTo(idx)}
                aria-label={`Ver imagem ${idx + 1} de ${images.length}`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md bg-gray-50 outline-none transition-all",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "ring-2 ring-foreground"
                    : "opacity-65 hover:opacity-100",
                )}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="68px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Carrossel scroll-snap (principal) */}
      <div className="relative flex-1">
        <div
          ref={containerRef}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden bg-gray-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:rounded-lg"
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
                quality={90}
                // object-contain (não cover) preserva enquadramento
                // original — crítico pra joalheria, perfumaria e calçado
                // do ICP do Mangos Pay onde "cortar a foto" descaracteriza
                // o produto. Background bg-gray-50 do container preenche
                // o espaço sobrando em fotos não-quadradas.
                className="h-auto w-full object-contain"
              />
            </figure>
          ))}
        </div>

        {/* Dots — canvas linhas 254-258. Em desktop ficam escondidos
            (thumbnails verticais já dão essa função de forma melhor). */}
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-3.5 flex items-center justify-center gap-1.5 lg:hidden">
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
                    active
                      ? "w-[18px] bg-foreground"
                      : "w-1.5 bg-black/25 hover:bg-black/40",
                  )}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
