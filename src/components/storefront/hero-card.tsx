/**
 * HeroCard — fiel ao canvas-referencia (canvas-v1).
 *
 * Hero editorial. Aspect 16/9. Border 1px border-border.
 *
 * Comportamento de fundo (revisado 2026-05-11):
 *   - Com `banner.imageUrl`: imagem edge-to-edge, SEM gradient brand
 *     sobreposto. Texto (kicker/title/subtitle/CTA) é opcional — quando
 *     todos vazios, é só a imagem. Quando algum vem preenchido, aplica
 *     um scrim escuro inferior pra garantir contraste.
 *   - Sem `banner.imageUrl`: usa gradient diagonal brand-store como
 *     fallback. Título cai pro nome da loja se não vier preenchido.
 *
 * Estrutura interna (canvas):
 *   - Kicker mono semibold cor brand-store, text-[9.5px] tracking 0.6
 *   - Título display 22px font-semibold tracking -0.6
 *   - Subtítulo 11.5px gray-600
 *   - CTA inline com seta: 11.5px font-medium cor brand-store
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
  const titleRaw = (banner as ActiveBanner & { title?: string | null }).title;
  const subtitle = (banner as ActiveBanner & { subtitle?: string | null })
    .subtitle;
  const ctaLabel =
    (banner as ActiveBanner & { ctaLabel?: string | null }).ctaLabel;
  const imageUrl = banner.imageUrl;

  // Com imagem, texto é OPCIONAL — só renderiza se preenchido.
  // Sem imagem, usa nome da loja como fallback do título (preserva
  // comportamento canvas-v1 para banners sem mídia).
  const title = imageUrl ? titleRaw : (titleRaw ?? storeName);
  const hasAnyText = Boolean(kicker || title || subtitle || ctaLabel);

  const imageAlt =
    (banner as ActiveBanner & { imageAlt?: string | null }).imageAlt ??
    title ??
    storeName;

  const ctaHref = banner.link ?? `/${storeSlug}/destaques`;

  return (
    <section
      aria-label="Destaque editorial"
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-border",
        "aspect-[16/9]",
        className,
      )}
      style={imageUrl ? undefined : { background: HERO_GRADIENT }}
    >
      {imageUrl && (
        <>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, 100vw"
            className="object-cover"
          />
          {/* Scrim escuro inferior só quando há texto a contrastar.
              Sem texto = imagem limpa edge-to-edge. */}
          {hasAnyText && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 via-black/25 to-transparent"
            />
          )}
        </>
      )}

      {/* Conteúdo (só renderiza se há algo a mostrar) */}
      {hasAnyText && (
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="space-y-1">
            {kicker && (
              <p
                className={cn(
                  "font-mono text-[9.5px] font-semibold tracking-[0.6px]",
                  imageUrl ? "text-white/90" : "text-brand-store",
                )}
              >
                {kicker}
              </p>
            )}
            {title && (
              <h1
                className={cn(
                  "text-[22px] font-semibold leading-[1.05] tracking-[-0.6px]",
                  imageUrl ? "text-white" : "text-foreground",
                )}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={cn(
                  "text-[11.5px] leading-[1.4]",
                  imageUrl ? "text-white/85" : "text-gray-600",
                )}
              >
                {subtitle}
              </p>
            )}
            {ctaLabel && (
              <div className="pt-2">
                <Link
                  href={ctaHref}
                  prefetch={false}
                  className={cn(
                    "group/cta inline-flex items-center gap-1.5 text-[11.5px] font-medium outline-none",
                    "focus-visible:underline focus-visible:underline-offset-2",
                    imageUrl ? "text-white" : "text-brand-store",
                  )}
                >
                  {ctaLabel}
                  <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
