"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Pitch shown on the brand panel (left side on desktop). */
  brand?: {
    eyebrow?: string;
    headline?: React.ReactNode;
    pitch?: string;
  };
}

const DEFAULT_BRAND = {
  eyebrow: "GESTÃO COMPLETA · LOJA ONLINE · WHATSAPP",
  headline: (
    <>
      Vende mais.
      <br />
      Confunde menos.
    </>
  ),
  pitch:
    "Mangos Pay junta catálogo online, balcão, estoque e clientes num só lugar. Feito pra loja de rua brasileira — no celular ou no computador.",
};

/**
 * Split-brand auth layout — rebrand Mangos Pay (2026-05-21).
 *
 * Desktop (≥1024px): grid 2 colunas 50/50. Esquerda verde Mangos com
 * gradiente, logo real do arquivo `/logos/logo.svg` (ícone + wordmark
 * juntos), watermark `/logos/favicon.svg` grande atrás do conteúdo,
 * headline copywriter + pitch. Direita surface branco com form centrado
 * max-w-[460px].
 *
 * Mobile (<1024px): stack vertical. Strip brand compacto no topo + form
 * abaixo.
 *
 * Logos via <img> (não next/image): next/image exigiria
 * `dangerouslyAllowSVG: true` no config — desnecessário pra assets
 * próprios.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
  brand,
}: AuthShellProps) {
  const brandContent = { ...DEFAULT_BRAND, ...brand };

  return (
    // Fundo geral cinza (mesmo do sidebar admin). Aside esquerdo flush nesse
    // cinza; section direita vira card branco flutuante com cantos
    // arredondados + margem mostrando o cinza (efeito "abraço" Abacate Pay,
    // replicado do `.b3-shell` + `.b3-main-card`). Mobile fica sem o efeito
    // (margens só em lg:) pra não desperdiçar viewport pequeno.
    <main className="min-h-dvh bg-[var(--mangos-side-bg)] lg:grid lg:grid-cols-2">
      {/* Brand panel — esquerda no desktop, strip topo no mobile.
          Fundo cinza-100 (mesmo do sidebar admin) — o logo e o texto
          escuro destacam sem competir com o verde já presente no logo. */}
      <aside
        className={cn(
          "relative flex flex-col justify-between overflow-hidden text-mangos-text-primary",
          "px-6 py-8 lg:px-14 lg:py-14",
          "bg-[var(--mangos-side-bg)]",
        )}
      >
        {/* Watermark — favicon (manga) atrás do conteúdo. Opacidade casa
            com a do sidebar admin (~7%) pra ficar perceptível mas não
            competir com o texto. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/favicon.svg"
          alt=""
          aria-hidden
          draggable={false}
          className={cn(
            "pointer-events-none absolute -right-16 -bottom-20 opacity-[0.07]",
            "h-[360px] w-[360px] lg:-right-24 lg:-bottom-28 lg:h-[560px] lg:w-[560px]",
          )}
        />

        {/* Logo — arquivo real /logos/logo.svg (ícone manga + wordmark
            "Mangos Pay" já dentro do SVG). Por isso não há <span> de texto. */}
        <Link
          href="/"
          className="relative inline-flex w-fit items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-mangos-yellow/60"
          aria-label="Mangos Pay — ir para o início"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo.svg"
            alt="Mangos Pay"
            className="h-9 w-auto lg:h-10"
            draggable={false}
          />
        </Link>

        {/* Pitch (escondido no mobile pra não ocupar viewport) */}
        <div className="relative hidden lg:block">
          {brandContent.eyebrow && (
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-mangos-orange">
              {brandContent.eyebrow}
            </div>
          )}
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em] text-mangos-green-950">
            {brandContent.headline}
          </h1>
          {brandContent.pitch && (
            <p className="mt-5 max-w-[400px] text-[15px] leading-[1.55] text-mangos-text-secondary">
              {brandContent.pitch}
            </p>
          )}
        </div>

        {/* Footer mono — só desktop */}
        <div className="relative hidden font-mono text-[11.5px] tracking-wider text-mangos-text-muted lg:block">
          © {new Date().getFullYear()} Mangos Pay · Sistema de gestão pra sua loja
        </div>
      </aside>

      {/* Form panel — card branco flutuante no desktop, flush no mobile.
          Em desktop: bg-surface (branco) + margem 16px em todos os lados
          mostrando o cinza ao redor + cantos arredondados 20px + sombra
          sutil (espelha `.b3-main-card` do admin). Em mobile: branco
          flush, sem rounding/shadow. */}
      <section
        className={cn(
          "flex items-center justify-center bg-surface px-6 py-10",
          "lg:m-4 lg:rounded-[20px] lg:px-14 lg:py-14",
          "lg:shadow-[0_1px_2px_color-mix(in_oklab,var(--ink-1)_4%,transparent),0_4px_12px_-6px_color-mix(in_oklab,var(--ink-1)_6%,transparent)]",
          className,
        )}
      >
        <div className="w-full max-w-[460px] animate-in fade-in slide-in-from-bottom-3 duration-300">
          <h2 className="text-[28px] font-bold tracking-[-0.025em] text-ink-1 lg:text-[30px]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2.5 mb-8 text-sm text-ink-4">{subtitle}</p>
          )}
          {!subtitle && <div className="mb-8" />}

          {children}

          {footer && (
            <div className="mt-7 border-t border-line pt-6 text-center text-sm text-ink-4">
              {footer}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
