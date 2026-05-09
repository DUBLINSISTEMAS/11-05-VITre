/**
 * Geração de código curto para pedidos.
 *
 * 4 chars alfanuméricos (sem caracteres ambíguos) — ~14M combos.
 * Risco de colisão a partir de ~4400 pedidos por loja (birthday paradox);
 * tolerável + retry resolve. ADR-0002.
 *
 * `customAlphabet` do nanoid em vez do default (que tem `-` e `_`):
 * códigos vão pra wa.me e cliente lê em voz alta — caracteres confusos
 * (0/O, 1/I/l) tirados.
 */
import { customAlphabet } from "nanoid";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars
const generate = customAlphabet(ALPHABET, 4);

export const SHORTCODE_LENGTH = 4;

/** Gera 1 código curto. Sem garantia de unicidade — caller faz retry no UNIQUE constraint. */
export function generateShortCode(): string {
  return generate();
}
