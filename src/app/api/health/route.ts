/**
 * Healthcheck público para monitores externos (UptimeRobot, Vercel deploy
 * smoke, futuras integrações Statuspage).
 *
 * Contrato público (gate H3 da auditoria 2026-05-11):
 *   200 + { ok: true,  db: "ok",   timestamp, elapsedMs }
 *   503 + { ok: false, db: "down", timestamp }
 *
 * Contrato detalhado (gate H3 — só com header `X-Health-Secret`):
 *   200 + { ok, db, role, bypassrls, timestamp, elapsedMs }
 *
 * Decisões:
 * - Sem auth pública: monitores externos precisam hit anônimo. Resposta
 *   pública NÃO expõe `role` nem `bypassrls` — fingerprint da arquitetura
 *   interna que ajudaria atacante a fazer password-spray no Supabase pooler.
 * - `X-Health-Secret` (env `HEALTH_SECRET`, opcional) destrava `role` +
 *   `bypassrls` pra smoke pós-deploy T1-1. Comparação via timingSafeEqual
 *   pra evitar timing attack (paranoia consistente com cron-auth).
 * - 503 NÃO retorna err.message (M2 da auditoria — pode vazar host/schema
 *   do Drizzle/pg). Stack vai pro Sentry via logger.error, não pro cliente.
 * - SELECT 1 + current_user é probe leve; não conta como query de tenant.
 * - `Cache-Control: no-store` impede CDN cachear estado momentâneo.
 *
 * Ref: production-readiness-tier1 / T1-9 + auditoria-adversarial-2026-05-11.
 */
import { timingSafeEqual } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthRow = { current_user: string; bypassrls: boolean };

function isDetailRequestAuthorized(request: Request): boolean {
  const secret = env.HEALTH_SECRET;
  if (!secret) return false; // sem secret configurado, detalhe nunca é exposto
  const provided = request.headers.get("x-health-secret");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const detailed = isDetailRequestAuthorized(request);

  // S6 (auditoria 2026-05-18): rate-limit por IP antes de tocar o pool.
  // /api/health é público (UptimeRobot) — sem limiter, atacante consegue
  // hammer o endpoint e esgotar connection pool (max:3) por minutos.
  // Requests detalhados (X-Health-Secret válido) bypassam o limite — só
  // o founder/CI deveria mandar esses, e o hit é mais caro.
  if (!detailed) {
    try {
      await checkRateLimit(rateLimits.publicApi, getClientIp(request.headers));
    } catch (err) {
      if (err instanceof RateLimitError) {
        return Response.json(
          { ok: false, db: "throttled", timestamp },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(err.retryAfterSeconds),
            },
          },
        );
      }
      throw err;
    }
  }

  try {
    const result = await db.execute<HealthRow>(
      sql`SELECT current_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls`,
    );
    const row = result.rows[0];

    const payload: Record<string, unknown> = {
      ok: true,
      db: "ok",
      timestamp,
      elapsedMs: Date.now() - start,
    };

    if (detailed) {
      payload.role = row?.current_user ?? "unknown";
      payload.bypassrls = row?.bypassrls ?? null;
    }

    return Response.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // M2: NÃO vazar err.message no payload — stack pode trazer host/schema.
    // Sentry/logger pega o detalhe pro founder; cliente só vê "down".
    logger.error("api.health.db_probe_failed", { err });
    return Response.json(
      {
        ok: false,
        db: "down",
        timestamp,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
