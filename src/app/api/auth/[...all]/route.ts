/**
 * Catch-all do Better Auth: /api/auth/sign-in, /api/auth/sign-up,
 * /api/auth/callback/google, /api/auth/reset-password, etc.
 *
 * S1.2 (2026-05-26 — PLANO-ENDURECIMENTO): rate limit por IP no POST.
 * Server actions já chamam `checkRateLimit(rateLimits.auth, ...)`, mas o
 * endpoint HTTP direto que Better Auth expõe (POST /api/auth/sign-up/email,
 * /api/auth/sign-in/email, etc.) bypassava esse gate. Atacante chamando
 * Better Auth direto via curl/fetch escapava do limite.
 *
 * Agora todo POST passa por `checkRateLimit(rateLimits.auth)` (5/10min/IP)
 * antes do handler do Better Auth processar. GET fica sem rate limit
 * (session checks legítimos do client podem ser frequentes).
 *
 * NÃO criar rotas /api/auth/* manualmente sem entender o impacto.
 */
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    await checkRateLimit(rateLimits.auth, ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      logger.warn("auth.rate_limit_blocked", {
        ip,
        path: req.nextUrl.pathname,
        retryAfterSeconds: err.retryAfterSeconds,
      });
      return Response.json(
        { error: err.message },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        },
      );
    }
    throw err;
  }
  return handlers.POST(req);
}
