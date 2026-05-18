/**
 * Rate limit via Upstash Redis (sliding window).
 * Detalhe da estratégia: docs/decisoes/0006-rate-limit-upstash.md
 *
 * Uso típico em server action:
 *   import { rateLimits, checkRateLimit, getClientIp } from "@/lib/rate-limit";
 *
 *   export const createOrderFromCart = async (input) => {
 *     await checkRateLimit(rateLimits.createOrder, getClientIp(await headers()));
 *     // ... lógica
 *   };
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const rateLimits = {
  /** Cliente final criando pedido (anônimo, por IP). 5 pedidos/min. */
  createOrder: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:order",
    analytics: true,
  }),
  /** Login / signup / reset password (por IP). 10 tentativas / 10min. */
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "rl:auth",
    analytics: true,
  }),
  /** Upload de imagem (autenticado, por user). 30 uploads/min. */
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:upload",
    analytics: true,
  }),
  /**
   * Mutações genéricas de admin (autenticado, por user). 60/min.
   * Cobre create/update/delete de produto, categoria, banner, etc.
   * Limite folgado o suficiente pra lojista cadastrar 30 produtos numa sentada,
   * mas barra script malicioso ou bug de loop infinito.
   */
  mutation: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:mut",
    analytics: true,
  }),
  /** API pública genérica (por IP). 60 req/min. */
  publicApi: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:api",
    analytics: true,
  }),
} as const;

/**
 * Erro lançado quando rate limit excedido.
 * Server actions devem deixar propagar; o error boundary do Next renderiza
 * uma mensagem amigável ao usuário.
 */
export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(`Muitas tentativas. Tente novamente em ${seconds}s.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = seconds;
  }
}

/**
 * Checa rate limit. Lança `RateLimitError` se excedido.
 * Caso contrário retorna void e a operação prossegue.
 *
 * Fail-open por design (auditoria 2026-05-18 — C7):
 *   - Se Upstash REST cair (rede/latência), NÃO derruba a operação;
 *     logger.warn registra o evento e o request prossegue. Trade-off:
 *     burst transitório passa, mas checkout/login não viram 500 em massa.
 *   - Se `identifier` for `null` (S7 — sem header confiável de IP), também
 *     fail-open com warn. Caller é responsável por logar contexto extra.
 *   - `RateLimitError` SEMPRE propaga (foi rejeição legítima do limiter).
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string | null,
): Promise<void> {
  if (identifier === null) {
    logger.warn("rate_limit.no_identifier", {
      limiter: limiter.constructor.name,
    });
    return;
  }
  try {
    const { success, reset } = await limiter.limit(identifier);
    if (!success) {
      throw new RateLimitError(reset - Date.now());
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    logger.warn("rate_limit.fail_open", {
      identifier,
      limiter: limiter.constructor.name,
      err,
    });
  }
}

/**
 * Extrai o IP do cliente a partir de Headers (vindos de `headers()` de next).
 *
 * Ordem de confiança:
 *   1. `cf-connecting-ip` (Cloudflare, se algum dia mover proxy pra lá)
 *   2. `x-forwarded-for` (Vercel inserta — usa o primeiro hop)
 *   3. `x-real-ip` (proxies que reescrevem direto)
 *
 * Retorna `null` quando NENHUM header confiável está presente (S7 da
 * auditoria 2026-05-18). Antes o fallback era a string `"anonymous"`, que
 * compartilhava bucket entre todos os requests sem header — atacante via
 * proxy custom esgotava o limite e DoS-ava usuários legítimos anônimos.
 *
 * Callers tipicamente passam o retorno direto pra `checkRateLimit`, que
 * trata `null` como fail-open com warn — consistente com C7. Se algum
 * fluxo exigir IP obrigatório (ex.: futura cobrança por IP), o caller
 * deve rejeitar 503 explicitamente.
 */
export function getClientIp(headers: Headers): string | null {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    const trimmed = cfIp.trim();
    if (trimmed) return trimmed;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  return null;
}
