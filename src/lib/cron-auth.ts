import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Validador constant-time do header `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Use em TODAS as routes `src/app/api/cron/*`. Vercel Cron envia o header
 * automaticamente quando `CRON_SECRET` está setado.
 *
 * Por que constant-time:
 *  - Compare com `===` é susceptível a timing-attack (vaza prefixo do segredo
 *    via timing). Para Vercel Cron interno é teórico — defesa em profundidade.
 *  - Buffers de tamanhos diferentes faríam `timingSafeEqual` throw, então o
 *    early-return faz dummy-compare contra ele mesmo pra preservar timing.
 */
export function isCronAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const expected = `Bearer ${env.CRON_SECRET}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) {
    // Compara contra ele mesmo pra preservar timing.
    timingSafeEqual(headerBuf, headerBuf);
    return false;
  }
  return timingSafeEqual(headerBuf, expectedBuf);
}
