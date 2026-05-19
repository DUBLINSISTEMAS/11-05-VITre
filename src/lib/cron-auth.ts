import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Autenticação de cron compatível com Vercel Hobby + Pro.
 *
 * # Por que dois caminhos
 *
 * - **Vercel Pro** injeta `Authorization: Bearer ${CRON_SECRET}` automaticamente
 *   nas chamadas internas do scheduler. `isAuthorizedCron` aceita esse header
 *   (mantém compat). Constant-time compare via `timingSafeEqual`.
 * - **Vercel Hobby** NÃO injeta o header — só dispara `GET <path>` puro. Sem
 *   header, a rota antiga retornava 401 silencioso e o cron NUNCA executava.
 *   Fix: aceitar `?sig=<hmac>` num path pré-assinado em `vercel.json`.
 *
 * # Forma do HMAC
 *
 *   sig = HMAC-SHA256(secret = CRON_SECRET, message = pathname)
 *
 * - `pathname` (ex.: `/api/cron/keep-alive`) entra na mensagem para evitar que
 *   um atacante que vaze a URL assinada de `keep-alive` reuse contra
 *   `expire-orders`.
 * - **Sem componente temporal**. Vercel Cron precisa de URL ESTÁTICA em
 *   `vercel.json` — não conseguimos rotacionar timestamp em tempo de schedule.
 *   Trade-off: a URL assinada vale enquanto `CRON_SECRET` não rotacionar.
 *   Mitigação operacional: rotacionar `CRON_SECRET` + re-gerar `vercel.json`
 *   periodicamente (ou ao detectar exposição). A URL fica em arquivo do repo
 *   privado, não em log público — superfície de leak é baixa.
 *
 * # Validação
 *
 * `isAuthorizedCron(request, pathname)`:
 *   1. Tenta header `Authorization: Bearer X` (compat Pro+).
 *   2. Tenta query `?sig=<hex>` recalculando HMAC server-side.
 *   3. Loga warn se ambos faltam (debug ops) ou se hmac inválido (possível
 *      tampering — vai pro Sentry via logger.warn? não, só error sobe; warn
 *      fica nos logs Vercel mesmo). Retorna false.
 *
 * Toda comparação usa `timingSafeEqual` — defesa em profundidade contra
 * timing-attack (teórica em rede interna, real se URL/header escapar via
 * proxy reverso mal-configurado).
 */

const CRON_PATHS = new Set([
  "/api/cron/keep-alive",
  "/api/cron/expire-orders",
]);

function safeEqualHex(a: string, b: string): boolean {
  // Buffers de tamanhos diferentes faríam timingSafeEqual throw —
  // dummy compare contra ele mesmo pra preservar timing antes do return.
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) {
      const dummy = Buffer.alloc(Math.max(ba.length, 1));
      timingSafeEqual(dummy, dummy);
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

function computeSig(pathname: string): string {
  return createHmac("sha256", env.CRON_SECRET).update(pathname).digest("hex");
}

/**
 * Validador dual de cron (header OU query HMAC).
 *
 * @param request - Request do route handler.
 * @param pathname - Caminho canônico do route (sem query/host), usado no HMAC.
 *                   Hard-coded em cada route pra evitar smuggling via header
 *                   `Host` ou `X-Forwarded-Host`.
 */
export function isAuthorizedCron(
  request: Request,
  pathname: string,
): boolean {
  // 1. Header Bearer (Vercel Pro+).
  const header = request.headers.get("authorization");
  if (header) {
    const expected = `Bearer ${env.CRON_SECRET}`;
    if (safeEqualUtf8(header, expected)) return true;
    logger.warn("cron.auth.bad_header", {
      pathname,
      headerPrefix: header.slice(0, 12),
    });
  }

  // 2. Query param `?sig=<hmac>` (Vercel Hobby + Pro).
  let sigParam: string | null = null;
  try {
    const url = new URL(request.url);
    sigParam = url.searchParams.get("sig");
  } catch {
    // URL malformada — sem cabimento autorizar.
    sigParam = null;
  }

  if (sigParam) {
    const expected = computeSig(pathname);
    if (safeEqualHex(sigParam, expected)) return true;
    logger.warn("cron.auth.bad_sig", { pathname });
  }

  if (!header && !sigParam) {
    logger.warn("cron.auth.missing_credentials", { pathname });
  }

  return false;
}

/**
 * Gera a URL assinada que vai em `vercel.json`.
 *
 * Uso (dev local):
 *   pnpm exec tsx scripts/sign-cron-urls.ts
 *
 * @param pathname - Ex.: `/api/cron/keep-alive`. Precisa estar em `CRON_PATHS`
 *                   pra prevenir caller errar e gerar HMAC pra rota que não
 *                   valida (assinatura "fantasma" inválida no destino).
 */
export function signCronUrl(pathname: string): string {
  if (!CRON_PATHS.has(pathname)) {
    throw new Error(
      `signCronUrl: pathname desconhecido "${pathname}". Conhecidos: ${[
        ...CRON_PATHS,
      ].join(", ")}`,
    );
  }
  const sig = computeSig(pathname);
  return `${pathname}?sig=${sig}`;
}

/**
 * @deprecated Use `isAuthorizedCron(request, pathname)`. Mantida pra evitar
 * quebra de imports em outras files durante a transição.
 */
export function isCronAuthorized(request: Request): boolean {
  // Sem pathname conhecido: só aceita header (modo legacy Pro+).
  const header = request.headers.get("authorization");
  if (!header) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  return safeEqualUtf8(header, expected);
}
