"use client";

import Image from "next/image";
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
  eyebrow: "★ GESTÃO COMPLETA · CATÁLOGO + WHATSAPP",
  headline: (
    <>
      Sua loja merece
      <br />
      um sistema sério.
    </>
  ),
  pitch:
    "O Vitrê é tudo o que sua loja precisa: catálogo online, PDV, estoque, clientes e relatórios — direto do celular.",
};

/**
 * Split-brand auth layout — Dublin v3 (ADR-0019).
 *
 * Desktop (≥1024px): grid 2 colunas 50/50. Esquerda navy gradient com
 * logo + pitch. Direita surface branco com form centrado max-w-[460px].
 *
 * Mobile (<1024px): stack vertical. Strip brand compacto no topo
 * (logo + 1 linha curta) + form abaixo.
 *
 * Substitui AuthCard nas rotas /entrar /redefinir /recuperar. AuthCard
 * continua em /criar-loja (será migrado na Onda 3 do port Dublin).
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
    <main className="min-h-dvh bg-surface lg:grid lg:grid-cols-2">
      {/* Brand panel — esquerda no desktop, strip topo no mobile */}
      <aside
        className={cn(
          "relative flex flex-col justify-between bg-brand text-white",
          "px-6 py-8 lg:px-14 lg:py-14",
          "bg-[linear-gradient(135deg,var(--brand),#2A4FA8)]",
        )}
      >
        {/* Logo */}
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Vitrê"
        >
          <Image
            src="/brand/logo-principal.webp"
            alt=""
            width={44}
            height={44}
            priority
            className="rounded-xl bg-white/15 p-1"
          />
          <span className="text-xl font-bold tracking-tight">Vitrê</span>
        </Link>

        {/* Pitch (escondido no mobile pra não ocupar viewport) */}
        <div className="hidden lg:block">
          {brandContent.eyebrow && (
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
              {brandContent.eyebrow}
            </div>
          )}
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em]">
            {brandContent.headline}
          </h1>
          {brandContent.pitch && (
            <p className="mt-5 max-w-[380px] text-[15px] leading-[1.55] text-white/85">
              {brandContent.pitch}
            </p>
          )}
        </div>

        {/* Footer mono — só desktop */}
        <div className="hidden font-mono text-[11.5px] tracking-wider text-white/60 lg:block">
          © {new Date().getFullYear()} Vitrê · Sistema de gestão pra sua loja
        </div>
      </aside>

      {/* Form panel — direita no desktop, abaixo no mobile */}
      <section
        className={cn(
          "flex items-center justify-center px-6 py-10 lg:px-14 lg:py-14",
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
