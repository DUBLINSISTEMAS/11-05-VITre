"use client";

/**
 * AnimatedAuthButton — CTA premium das telas auth (Onda 35).
 *
 * Adaptado do "Lab Botton" do Uiverse pras cores do brand Mangos Pay
 * (mangos-green-700/800 em vez do emerald do exemplo). Tamanho fixo
 * 48px de altura — bate com o b3-btn--cta que substituiu em /entrar.
 *
 * Camadas (todas via CSS em globals.css, prefixo .aab-*):
 *  - base gradient verde escuro
 *  - overlay hover que faz wipe da esquerda
 *  - shimmer (faixa branca a cada 5s)
 *  - 10 floating points subindo do fundo
 *  - inner com texto + ícone (transição cor no hover)
 *
 * Respeita `prefers-reduced-motion: reduce`.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AnimatedAuthButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
}

export function AnimatedAuthButton({
  children,
  className,
  type = "button",
  ...rest
}: AnimatedAuthButtonProps) {
  return (
    <button {...rest} type={type} className={cn("aab-root", className)}>
      <div className="aab-points" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className="aab-point" />
        ))}
      </div>
      <span className="aab-inner">{children}</span>
    </button>
  );
}
