/**
 * HeroCard — fiel ao canvas-referencia (canvas-v1).
 *
 * Hero editorial. Aspect 16/9. Background: gradient diagonal de
 * `color-mix(brand-store 25%, white)` → `color-mix(brand-store 8%, white)`.
 * Border 1px border-border, padding 16, content alinhado em flex-end.
 *
 * Estrutura interna (canvas):
 *   - Kicker mono semibold cor brand-store, text-[9.5px] tracking 0.6
 *   - Título display 22px font-semibold tracking -0.6 (cor foreground)
 *   - Subtítulo 11.5px gray-600 (subtle)
 *   - CTA inline com seta: 11.5px font-medium cor brand-store
 *
 * Server Component. Lê campos editoriais de banner (kicker/title/subtitle/
 * ctaLabel) — todos opcionais. Quando ausentes, renderiza fallback
 * minimalista (apenas imagem ou nome da loja).
 *
 * Imagem opcional sobreposta via aspect-ratio: quando banner.imageUrl
 * existe, ela aparece de fundo COM o gradient ainda mantendo legibilidade
 * via overlay sutil. Quando ausente, só o gradient brand-store.
 */
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ActiveBanner } from "@/lib/storefront/banners-loader";
import { cn } from "@/lib/utils";

export interface HeroCardProps {
  banner: ActiveBanner;
  storeSlug: string;
  storeName: string;
  /** Aplica `priority` na imagem (use no LCP slot). */
  priority?: boolean;
  className?: string;
}

const HERO_GRADIENT =
  "linear-gradient(135deg, color-mix(in oklch, var(--brand-store) 25%, white) 0%, color-mix(in oklch, var(--brand-store) 8%, white) 100%)";

export function HeroCard({
  banner,
  storeSlug,
  storeName,
  priority = false,
  className,
}: HeroCardProps) {
  // Campos editoriais (canvas): nullable após migration 0007
  const kicker = (banner as ActiveBanner & { kicker?: string | null }).kicker;
  const title =
    (banner as ActiveBanner & { title?: string | null }).title ?? storeName;
  const subtitle = (banner as ActiveBanner & { subtitle?: string | null })
    .subtitle;
  const ctaLabel =
    (banner as ActiveBanner & { ctaLabel?: string | null }).ctaLabel;
  const imageUrl = banner.imageUrl;
  const imageAlt =
    (banner as ActiveBanner & { imageAlt?: string | null }).imageAlt ?? title;

  const ctaHref = banner.link ?? `/${storeSlug}/destaques`;

  return (
    <section
      aria-label="Destaque editorial"
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-border",
        "aspect-[16/9]",
        className,
      )}
      style={{ background: HERO_GRADIENT }}
    >
      {imageUrl && (
        <>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, 100vw"
            className="object-cover opacity-60 mix-blend-multiply"
          />
          {/* gradient sobreposto pra preservar contraste do texto */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: HERO_GRADIENT, opacity: 0.55 }}
          />
        </>
      )}

      {/* Conteúdo */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="space-y-1">
          {kicker && (
            <p className="font-mono text-[9.5px] font-semibold tracking-[0.6px] text-brand-store">
              {kicker}
            </p>
          )}
          <h1 className="text-[22px] font-semibold leading-[1.05] tracking-[-0.6px] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11.5px] leading-[1.4] text-gray-600">
              {subtitle}
            </p>
          )}
          {ctaLabel && (
            <div className="pt-2">
              <Link
                href={ctaHref}
                prefetch={false}
                className={cn(
                  "group/cta inline-flex items-center gap-1.5 text-[11.5px] font-medium text-brand-store outline-none",
                  "focus-visible:underline focus-visible:underline-offset-2",
                )}
              >
                {ctaLabel}
                <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
