/**
 * Paleta sugerida para a cor primária do storefront da loja.
 * Lojista pode escolher uma das opções OU digitar hex custom.
 *
 * Decisão: paleta curada (não color picker livre) — evita lojista escolher
 * roxo neon que destrói contraste. Ver ADR-0007.
 */

export interface SuggestedColor {
  name: string;
  value: string; // hex #RRGGBB
}

export const SUGGESTED_PRIMARY_COLORS: readonly SuggestedColor[] = [
  { name: "Azul Vitrê", value: "#1E3FE6" },
  { name: "Preto", value: "#0A0A0A" },
  { name: "Rosa", value: "#E91E63" },
  { name: "Verde", value: "#10B981" },
  { name: "Vinho", value: "#9F1239" },
  { name: "Areia", value: "#A38468" },
  { name: "Roxo", value: "#7C3AED" },
  { name: "Laranja", value: "#EA580C" },
] as const;

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(input: string): boolean {
  return HEX_REGEX.test(input);
}
