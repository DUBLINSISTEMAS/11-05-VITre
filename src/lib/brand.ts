/**
 * Paleta sugerida para a cor primária do storefront da loja.
 * Lojista pode escolher uma das opções OU digitar hex custom.
 *
 * Decisão: paleta curada (não color picker livre) — evita lojista escolher
 * roxo neon que destrói contraste. Ver ADR-0007.
 *
 * Grid 6x2 (12 cores) cobrindo os nichos típicos da plataforma (moda,
 * joia/semijoia, perfumaria, decoração).
 */

export interface SuggestedColor {
  name: string;
  value: string; // hex #RRGGBB
}

export const SUGGESTED_PRIMARY_COLORS: readonly SuggestedColor[] = [
  { name: "Azul Mangos Pay", value: "#1E3FE6" },
  { name: "Vermelho", value: "#DC2626" },
  { name: "Rosa", value: "#E91E63" },
  { name: "Verde", value: "#10B981" },
  { name: "Dourado", value: "#D4A017" },
  { name: "Preto", value: "#0A0A0A" },
  { name: "Branco", value: "#FFFFFF" },
  { name: "Roxo", value: "#7C3AED" },
  { name: "Laranja", value: "#EA580C" },
  { name: "Turquesa", value: "#14B8A6" },
  { name: "Areia", value: "#D8B894" },
  { name: "Marrom", value: "#7C2D12" },
] as const;

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(input: string): boolean {
  return HEX_REGEX.test(input);
}
