import type { CSSProperties, ReactNode } from "react";

import { isValidHexColor } from "@/lib/brand";

/**
 * Injeta a cor da loja no token `--brand-store` do design system.
 *
 * Escopo da brand color (ADR-0011): bottom-nav + badge da sacola apenas.
 * NÃO sobrescreve `--primary` (que é fixo Vitrê) nem `--ring` (neutro).
 *
 * Uso esperado: layout do storefront passa `store.primaryColor` (hex válido).
 * Sem prop, o provider é no-op — fallback é `--primary` herdado do :root.
 *
 * Implementado como server component: a cor é fixa no momento do render
 * da loja. Sem hidratação cliente, sem flicker.
 */
export interface BrandProviderProps {
  /** Hex da cor da loja (#RRGGBB). Inválido → ignora e usa fallback. */
  color?: string;
  /** Hex da cor do texto sobre brand-store. Default: branco. */
  foreground?: string;
  children: ReactNode;
}

export function BrandProvider({
  color,
  foreground = "#FFFFFF",
  children,
}: BrandProviderProps) {
  const style =
    color && isValidHexColor(color)
      ? ({
          "--brand-store": color,
          "--brand-store-foreground": foreground,
        } as CSSProperties)
      : undefined;

  return <div style={style}>{children}</div>;
}
