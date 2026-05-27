/**
 * HeroCard — banner editorial do storefront.
 *
 * Tematizado (Onda C): aceita prop `variant`:
 *
 *   "cover"   (default — canvas-v1): imagem fundo edge-to-edge, scrim
 *             escuro inferior só quando há texto, kicker+title+subtitle+CTA
 *             em overlay no canto inferior esquerdo. Aspect 16:9.
 *
 *   "split"   (preset Boutique): grid 50/50 — imagem à esquerda em
 *             aspect-square, texto centrado vertical à direita em fundo
 *             neutro. Sem scrim. Texto sempre em foreground.
 *             Sem imagem → ramo similar ao "minimal" com texto à direita.
 *
 *   "minimal" (preset Bazar): IGNORA `imageUrl`, sempre usa o gradient
 *             diagonal brand-store. Texto centralizado (horizontal e
 *             vertical). CTA pill discreto em vez de seta inline.
 *             Aspect 16:9 mantido.
 *
 * Comportamento de fundo (canvas, ramo "cover"):
 *   - Com `banner.imageUrl`: imagem edge-to-edge. Sem texto = imagem
 *     limpa. Com texto = scrim escuro inferior pra contraste.
 *   - Sem `banner.imageUrl`: usa gradient diagonal brand-store.
 *
 * Tokens:
 *   - Kicker: font-mono semibold cor brand-store, text-[9.5px] tracking 0.6
 *   - Título: display 22px font-semibold tracking -0.6
 *   - Subtítulo: 11.5px gray-600
 *   - CTA: 11.5px font-medium cor brand-store
 */
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Banner as ActiveBanner } from "@/db/schema";
import type { HeroVariant } from "@/lib/storefront/themes";
import { cn } from "@/lib/utils";

export interface HeroCardProps {
  banner: ActiveBanner;
  storeSlug: string;
  storeName: string;
  /** Eixo de tema. Default "cover" (canvas-v1). */
  variant?: HeroVariant;
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
  variant = "cover",
  priority = false,
  className,
}: HeroCardProps) {
  // Campos editoriais (canvas): nullable após migration 0007
  const kicker = (banner as ActiveBanner & { kicker?: string | null }).kicker;
  const titleRaw = (banner as ActiveBanner & { title?: string | null }).title;
  const subtitle = (banner as ActiveBanner & { subtitle?: string | null })
    .subtitle;
  const ctaLabel = (banner as ActiveBanner & { ctaLabel?: string | null })
    .ctaLabel;
  const imageUrl = banner.imageUrl;

  // Sem imagem (em qualquer variant), nome da loja é fallback do título.
  const fallbackTitle = titleRaw ?? storeName;
  const ctaHref = banner.link ?? `/${storeSlug}/destaques`;

  if (variant === "split") {
    return (
      <HeroSplit
        kicker={kicker}
        title={titleRaw ?? fallbackTitle}
        subtitle={subtitle}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        imageUrl={imageUrl}
        imageAlt={
          (banner as ActiveBanner & { imageAlt?: string | null }).imageAlt ??
          titleRaw ??
          storeName
        }
        priority={priority}
        className={className}
      />
    );
  }

  if (variant === "minimal") {
    return (
      <HeroMinimal
        kicker={kicker}
        title={fallbackTitle}
        subtitle={subtitle}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        className={className}
      />
    );
  }

  return (
    <HeroCover
      kicker={kicker}
      title={imageUrl ? titleRaw : fallbackTitle}
      subtitle={subtitle}
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
      imageUrl={imageUrl}
      imageAlt={
        (banner as ActiveBanner & { imageAlt?: string | null }).imageAlt ??
        titleRaw ??
        storeName
      }
      priority={priority}
      className={className}
      storeSlug={storeSlug}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// COVER (canvas-v1 — comportamento original)
// ─────────────────────────────────────────────────────────────────────

interface CoverProps {
  kicker: string | null | undefined;
  title: string | null | undefined;
  subtitle: string | null | undefined;
  ctaLabel: string | null | undefined;
  ctaHref: string;
  imageUrl: string | null;
  imageAlt: string;
  priority: boolean;
  className?: string;
}

function HeroCover({
  kicker,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt,
  priority,
  className,
  storeSlug,
}: CoverProps & { storeSlug: string }) {
  const hasAnyText = Boolean(kicker || title || subtitle || ctaLabel);
  // CTA primary: label do banner ou fallback amigável.
  const primaryLabel = ctaLabel?.trim() || "Explorar agora";
  // CTA secondary: aponta pra /destaques. Label fixa "Editor's pick" da
  // ref Dribbble 1 (sutilmente traduzida) — comunica curadoria sem
  // depender de a loja ter "vitrines" cadastradas.
  const secondaryHref = `/${storeSlug}/destaques`;
  const secondaryLabel = "Mais escolhidos";

  return (
    <section
      aria-label="Destaque editorial"
      className={cn(
        "relative overflow-hidden",
        // Mobile: full-bleed (sem border/rounded), aspect 4:5 vertical
        // — formato Instagram-friendly, equilibra impacto visual sem
        // dominar a fold (469px num iPhone 375px).
        // Desktop (lg+): container com border+rounded, aspect 3:1
        // magazine cinematográfico — discreto, 400px em 1200px, deixa
        // espaço pro grid de produtos na primeira dobra.
        "aspect-[4/5] lg:aspect-[3/1] lg:rounded-[20px] lg:border lg:border-border",
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
            // Mobile: imagem cobre 100vw (full-bleed).
            // Desktop ≥1024px: largura limitada pelo container (max
            // 1200px com px-4) → reduz bytes baixados em telas grandes.
            sizes="(max-width: 1024px) 100vw, 1200px"
            quality={90}
            className="object-cover"
          />
          {/* Scrim premium em duas camadas pra contraste de texto sólido
              mas sem matar a foto. Bottom 70% começa com 60% black e
              degrada — referência ref Dribbble 1. */}
          {hasAnyText && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/65 via-black/30 to-transparent"
            />
          )}
        </>
      )}

      {hasAnyText && (
        <div className="absolute inset-0 flex flex-col justify-end p-5 lg:p-8">
          <div className="max-w-md space-y-2 lg:space-y-3">
            {kicker && (
              <p
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase tracking-[0.8px]",
                  imageUrl ? "text-white/85" : "text-primary",
                )}
              >
                {kicker}
              </p>
            )}
            {title && (
              <h1
                className={cn(
                  // Mobile 28px (ref 1 mede ~24-26 em iPhone 375; subo
                  // pra 28 pra peso visual). Desktop 40px. Tracking
                  // apertado pra parecer editorial (Zara/Aritzia).
                  "text-[28px] font-bold leading-[1.05] tracking-[-0.8px] [text-wrap:balance] lg:text-[40px] lg:leading-[1.0] lg:tracking-[-1.2px]",
                  imageUrl ? "text-white" : "text-foreground",
                )}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={cn(
                  "text-[13px] leading-[1.4] lg:text-[15px] lg:leading-[1.45]",
                  imageUrl ? "text-white/85" : "text-gray-600",
                )}
              >
                {subtitle}
              </p>
            )}

            {/* 2 CTAs ref Dribbble 1:
                Primary pill verde sólido (--primary) — alvo principal.
                Secondary pill outlined branco (sobre imagem) — alvo
                explorador, ghosty. Em fundos sem imagem (variants sem
                foto), secondary fica outlined neutro. */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-3">
              <Link
                href={ctaHref}
                prefetch={false}
                className={cn(
                  "group/cta inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold outline-none transition-all",
                  "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85 shadow-[0_4px_14px_rgba(0,0,0,0.15)]",
                  "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30",
                )}
                style={{ touchAction: "manipulation" }}
              >
                {primaryLabel}
                <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
              </Link>

              <Link
                href={secondaryHref}
                prefetch={false}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold outline-none transition-colors",
                  imageUrl
                    ? "bg-white/15 text-white backdrop-blur-sm ring-1 ring-inset ring-white/40 hover:bg-white/25 active:bg-white/30"
                    : "bg-background text-foreground ring-1 ring-inset ring-border hover:bg-muted",
                  "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30",
                )}
                style={{ touchAction: "manipulation" }}
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SPLIT (preset Boutique — imagem + texto lado a lado)
// ─────────────────────────────────────────────────────────────────────

interface SplitProps {
  kicker: string | null | undefined;
  title: string | null | undefined;
  subtitle: string | null | undefined;
  ctaLabel: string | null | undefined;
  ctaHref: string;
  imageUrl: string | null;
  imageAlt: string;
  priority: boolean;
  className?: string;
}

function HeroSplit({
  kicker,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt,
  priority,
  className,
}: SplitProps) {
  return (
    <section
      aria-label="Destaque editorial"
      className={cn(
        // Mobile: stack vertical (imagem topo, texto bottom).
        // Desktop: 50/50 grid horizontal com container.
        "relative grid grid-cols-1 overflow-hidden bg-background",
        "lg:grid-cols-2 lg:rounded-[14px] lg:border lg:border-border",
        className,
      )}
    >
      <div
        className="relative aspect-[4/5] lg:aspect-square"
        style={imageUrl ? undefined : { background: HERO_GRADIENT }}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="(max-width: 1024px) 100vw, 600px"
            quality={90}
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-1.5 p-4 sm:p-5">
        {kicker && (
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.6px] text-brand-store">
            {kicker}
          </p>
        )}
        {title && (
          <h1 className="text-[18px] font-semibold leading-[1.1] tracking-[-0.4px] text-foreground sm:text-[22px]">
            {title}
          </h1>
        )}
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
              className="group/cta inline-flex items-center gap-1.5 text-[11.5px] font-medium text-brand-store outline-none focus-visible:underline focus-visible:underline-offset-2"
            >
              {ctaLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MINIMAL (preset Bazar — só texto centralizado, ignora imagem)
// ─────────────────────────────────────────────────────────────────────

interface MinimalProps {
  kicker: string | null | undefined;
  title: string | null | undefined;
  subtitle: string | null | undefined;
  ctaLabel: string | null | undefined;
  ctaHref: string;
  className?: string;
}

function HeroMinimal({
  kicker,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  className,
}: MinimalProps) {
  return (
    <section
      aria-label="Destaque editorial"
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden px-4 text-center",
        // Mesma régua dos outros variants: full-bleed mobile 4:5,
        // container desktop 3:1.
        "aspect-[4/5] lg:aspect-[3/1] lg:rounded-[14px] lg:border lg:border-border",
        className,
      )}
      style={{ background: HERO_GRADIENT }}
    >
      <div className="max-w-md space-y-1.5">
        {kicker && (
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.6px] text-brand-store">
            {kicker}
          </p>
        )}
        {title && (
          <h1 className="text-[20px] font-semibold leading-[1.1] tracking-[-0.4px] text-foreground sm:text-[24px]">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-[11.5px] leading-[1.4] text-gray-700">
            {subtitle}
          </p>
        )}
        {ctaLabel && (
          <div className="pt-2">
            <Link
              href={ctaHref}
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-[11.5px] font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2"
            >
              {ctaLabel}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
