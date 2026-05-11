/**
 * Geração de código curto para pedidos.
 *
 * 6 chars alfanuméricos (sem caracteres ambíguos) — 32^6 ≈ 1.07B combos.
 * Gate H2 da auditoria 2026-05-11: shortCode de 4 chars (~1M combos)
 * permitia enumeration em ~11 dias pelo rate-limit publicApi de 60/min.
 * 6 chars × 60 rpm = ~30 anos pra varrer o espaço completo — fora de
 * limite prático de ataque.
 *
 * Compatibilidade com 4-char antigos:
 *  - Schema `order.short_code` é `text` (unbounded) — não exige migration.
 *  - Loader (`getOrderByShortCode`) faz `eq(shortCode, x)` exact match,
 *    aceita qualquer length naturalmente. Pedidos pré-2026-05-11
 *    continuam acessíveis pelos códigos antigos.
 *  - Risco residual: pedidos 4-char antigos ainda enumeráveis. Aceitável
 *    pq são pedidos seed/teste de Sandra; pedidos reais (pós-deploy) já
 *    nascem com 6 chars.
 *
 * Risco de colisão com 6 chars: birthday paradox prevê ~38k pedidos
 * pra 50% de colisão — fora de cenário MVP. Retry de UNIQUE no caller
 * cobre o caso degenerado.
 *
 * `customAlphabet` do nanoid em vez do default (que tem `-` e `_`):
 * códigos vão pra wa.me e cliente lê em voz alta — caracteres confusos
 * (0/O, 1/I/l) tirados.
 */
import { customAlphabet } from "nanoid";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars
const generate = customAlphabet(ALPHABET, 6);

export const SHORTCODE_LENGTH = 6;

/** Gera 1 código curto. Sem garantia de unicidade — caller faz retry no UNIQUE constraint. */
export function generateShortCode(): string {
  return generate();
}
