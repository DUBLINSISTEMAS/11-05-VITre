/**
 * Cron de expiração de pedidos `awaiting_whatsapp`.
 *
 * Pedidos têm `expires_at = now() + 14d` setado em `create-from-cart.ts`.
 * Sem este cron, pedido abandonado fica `awaiting_whatsapp` indefinidamente
 * — bloqueia estoque (via decremento atômico em variant ou produto) e polui
 * a lista de pedidos do lojista.
 *
 * Vercel chama esta rota pelo schedule definido em `vercel.json` (06:00 UTC).
 *
 * Proteção:
 *  - Header `Authorization: Bearer ${CRON_SECRET}` é enviado pela Vercel
 *    quando a env `CRON_SECRET` está setada. Validamos via
 *    `crypto.timingSafeEqual` (não `===` direto — timing attack).
 *  - GET sem header → 401.
 *
 * Cross-tenant by design:
 *  - SELECT inicial usa `withServiceRole` (cron precisa varrer todas as
 *    lojas). Cada pedido é processado em sua própria `withTenant` —
 *    transações INDEPENDENTES, então uma falha não derruba o batch.
 *
 * Idempotência:
 *  - O UPDATE final usa optimistic lock (`AND status = 'awaiting_whatsapp'`).
 *    Se outro processo (ex: lojista cancelando manualmente via UI) já mudou
 *    o status, o UPDATE vira no-op — sem double-restock.
 *
 * Documentação: convenção #4 (revalidateTag) + #1 (RLS-first).
 */
import { timingSafeEqual } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { orderTable, storeTable } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { restockOrderItems } from "@/lib/order/restock";
import { ANON_USER_ID, withServiceRole, withTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ExpiredCandidate {
  orderId: string;
  storeId: string;
  storeSlug: string;
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const expected = `Bearer ${env.CRON_SECRET}`;
  // Buffers precisam ter o MESMO comprimento pra timingSafeEqual não throw.
  // Padding manual mantém a comparação constant-time mesmo em mismatch de
  // tamanho (dummy compare em vez de short-circuit).
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) {
    // Compara contra ele mesmo pra preservar timing.
    timingSafeEqual(headerBuf, headerBuf);
    return false;
  }
  return timingSafeEqual(headerBuf, expectedBuf);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();

  // 1. Lista pedidos a expirar — cross-tenant, então withServiceRole.
  //    JOIN com store pra ter o slug pronto pra revalidateTag.
  const candidates = await withServiceRole<ExpiredCandidate[]>(
    "cron expire-orders: SELECT awaiting_whatsapp + expires_at < now()",
    async (tx) =>
      tx
        .select({
          orderId: orderTable.id,
          storeId: orderTable.storeId,
          storeSlug: storeTable.slug,
        })
        .from(orderTable)
        .innerJoin(storeTable, eq(storeTable.id, orderTable.storeId))
        .where(
          and(
            eq(orderTable.status, "awaiting_whatsapp"),
            lt(orderTable.expiresAt, sql`now()`),
          ),
        ),
  );

  let expiredCount = 0;
  let errorCount = 0;
  const storesTouched = new Set<string>();
  const errors: Array<{ orderId: string; message: string }> = [];

  // 2. Processa cada pedido em transação INDEPENDENTE — falha de um não
  //    derruba o batch. Cada try/catch agrega no relatório.
  for (const candidate of candidates) {
    try {
      const result = await withTenant<{ updated: number }>(
        candidate.storeId,
        ANON_USER_ID,
        async (tx) => {
          // 2a. Repõe estoque (mesmo tx).
          await restockOrderItems(tx, candidate.orderId, candidate.storeId);

          // 2b. UPDATE com optimistic lock — se outro fluxo já mudou o
          //     status, retorna 0 rows (no-op) e a tx commita o no-op
          //     restock (que já não fez nada porque os itens não tinham
          //     trackStock — caso degenerado).
          //     Filtro adicional `expires_at < now()` evita race com lojista
          //     editando expiresAt entre o SELECT e o UPDATE.
          const updated = await tx
            .update(orderTable)
            .set({ status: "expired" })
            .where(
              and(
                eq(orderTable.id, candidate.orderId),
                eq(orderTable.storeId, candidate.storeId),
                eq(orderTable.status, "awaiting_whatsapp"),
                lt(orderTable.expiresAt, sql`now()`),
              ),
            )
            .returning({ id: orderTable.id });

          return { updated: updated.length };
        },
      );

      if (result.updated > 0) {
        expiredCount += 1;
        storesTouched.add(candidate.storeSlug);
      }
    } catch (err) {
      errorCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ orderId: candidate.orderId, message });
      logger.error("cron.expire_orders.process_failed", {
        orderId: candidate.orderId,
        storeId: candidate.storeId,
        err,
      });
    }
  }

  // 3. revalidateTag UMA vez por loja afetada (Set evita duplicação).
  for (const slug of storesTouched) {
    revalidateTag(`store-${slug}`);
  }

  const payload = {
    ok: errorCount <= expiredCount,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    expired: expiredCount,
    errors: errorCount,
    storesTouched: storesTouched.size,
    candidates: candidates.length,
    errorSamples: errors.slice(0, 5),
  };

  // Status 500 se errors > expired — sinal de degradação (mais falhas que
  // sucessos). Vercel monitor pode alertar.
  const status = errorCount > expiredCount ? 500 : 200;
  return Response.json(payload, { status });
}
