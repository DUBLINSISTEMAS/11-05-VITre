"use client";

/**
 * MiniCartBar — barra de "modo compra" fixa no rodapé.
 *
 * Aparece em páginas de listagem (categoria, busca, destaques, coleção)
 * quando o cliente tem 1+ item na sacola. Some quando carrinho vazia.
 * Empilha ACIMA do bottom-nav (não substitui) — bottom-nav permanece
 * pra navegação primária; mini-cart é atalho contextual pro fechamento.
 *
 * Inspiração: tela 2 da ref Dribbble 1 ("Total items in bag · View Bag").
 *
 * Heurísticas:
 *  - Nielsen #1 (visibility of system status): cliente vê resumo do
 *    carrinho sem rolar até o ícone no bottom-nav.
 *  - Fitts: CTA pill grande na linha do polegar, encerrando a jornada
 *    de compra em 1 tap.
 *
 * z-index: 39 (1 abaixo do bottom-nav z-40 — visualmente empilhado mas
 * focável pelo teclado em ordem natural).
 */
import { ArrowRightIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/hooks/use-cart";
import { formatBRL } from "@/lib/pricing";

export interface MiniCartBarProps {
  storeSlug: string;
}

const BOTTOM_NAV_HEIGHT = 76; // ~ pill nav h: 28 pill + 14 pt + safe-area

export function MiniCartBar({ storeSlug }: MiniCartBarProps) {
  const { count, subtotalCents, isHydrated } = useCart();

  // Antes da hidratação OU carrinho vazio → não renderiza nada.
  // Evita flash do mini-cart no SSR (renderiza só client-side).
  if (!isHydrated || count === 0) return null;

  const label = count === 1 ? "1 item na sacola" : `${count} itens na sacola`;

  return (
    <div
      aria-label="Resumo da sacola"
      className="animate-in fade-in-0 slide-in-from-bottom-3 fixed inset-x-0 z-[39] px-3 duration-300 lg:hidden"
      style={{
        bottom: `calc(env(safe-area-inset-bottom) + ${BOTTOM_NAV_HEIGHT}px)`,
      }}
    >
      <Link
        href={`/${storeSlug}/sacola`}
        prefetch={false}
        className="group flex h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 text-primary-foreground shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] outline-none transition-all hover:bg-primary/95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ touchAction: "manipulation" }}
      >
        <div className="flex items-center gap-3">
          <span className="relative grid size-9 place-items-center rounded-xl bg-white/15">
            <ShoppingBagIcon
              className="size-[18px]"
              strokeWidth={2}
              aria-hidden
            />
            <span
              aria-hidden
              className="bg-primary-foreground text-primary absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            >
              {count > 99 ? "99+" : count}
            </span>
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-white/70">
              {label}
            </span>
            <span className="font-mono text-[15px] font-semibold tabular-nums">
              {formatBRL(subtotalCents)}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.1px]">
          Ver sacola
          <ArrowRightIcon
            className="size-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
        </span>
      </Link>
    </div>
  );
}
