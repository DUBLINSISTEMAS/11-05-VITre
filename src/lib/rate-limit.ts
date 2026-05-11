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
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<void> {
  const { success, reset } = await limiter.limit(identifier);
  if (!success) {
    throw new RateLimitError(reset - Date.now());
  }
}

/**
 * Extrai o IP do cliente a partir de Headers (vindos de `headers()` de next).
 * Vercel injeta `x-forwarded-for`. Fallback: `x-real-ip` ou `"anonymous"`.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "anonymous";
}
