/**
 * Cron de keep-alive para evitar auto-pausa do Supabase Free (7 dias inativo).
 * Vercel chama esta rota pelo schedule definido em `vercel.json` (09:00 UTC).
 *
 * Proteção: Hobby plan não injeta Authorization header — usamos query param
 * assinado HMAC via `isAuthorizedCron(request, CRON_PATHNAME)` (constant-time,
 * compartilhado com expire-orders).
 *
 * Documentação: docs/decisoes/0005-free-tier-supabase-vercel-resend.md
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_PATHNAME = "/api/cron/keep-alive";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request, CRON_PATHNAME)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    logger.error("cron.keep_alive.db_ping_failed", { err });
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - start,
  });
}
