/**
 * Healthcheck público para monitores externos (UptimeRobot, Vercel deploy
 * smoke, futuras integrações Statuspage).
 *
 * Contrato:
 *   200 + { ok: true,  db: "ok",   role, bypassrls, timestamp, elapsedMs }
 *   503 + { ok: false, db: "down", error,                       timestamp }
 *
 * Decisões:
 * - Sem auth: monitores externos precisam hit anônimo. Resposta não expõe
 *   stack/versão; só estado boolean + role corrente.
 * - `role` + `bypassrls` no payload validam T1-1 (DATABASE_URL apontando
 *   pra `vitre_app`). Smoke pós-deploy bate aqui e checa
 *   `role==="vitre_app" && bypassrls===false`.
 * - SELECT 1 + current_user é probe leve; não conta como query de tenant.
 * - `Cache-Control: no-store` impede CDN cachear estado momentâneo.
 *
 * Ref: production-readiness-tier1 / T1-9.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthRow = { current_user: string; bypassrls: boolean };

export async function GET() {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const result = await db.execute<HealthRow>(
      sql`SELECT current_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls`,
    );
    const row = result.rows[0];

    return Response.json(
      {
        ok: true,
        db: "ok",
        role: row?.current_user ?? "unknown",
        bypassrls: row?.bypassrls ?? null,
        timestamp,
        elapsedMs: Date.now() - start,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    logger.error("api.health.db_probe_failed", { err });
    return Response.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
