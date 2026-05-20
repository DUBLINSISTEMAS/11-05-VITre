/**
 * Sprint 6A — audit log helper.
 *
 * `recordAuditEvent(tx, ...)` grava uma linha em `audit_event` dentro
 * da MESMA transação da mutação principal. Se a transação rollar,
 * o evento some junto (consistência — não fica auditando algo que
 * nunca aconteceu).
 *
 * Tolerância a falha: o INSERT é envolto em try/catch. Falha de
 * audit NÃO derruba a operação principal (princípio: audit é
 * defensivo, não bloqueante). Erros viram log.warn.
 *
 * IP/UA: melhor caller passar via `headers()`. Pra simplificar v1,
 * helper aceita valores opcionais — caller decide se vale a pena.
 */
import { auditEventTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Tx } from "@/lib/tenant";

export interface AuditEventInput {
  storeId: string;
  /** NULL = sistema (cron, trigger). */
  actorUserId: string | null;
  /** Namespaced action, ex: "receivable.payment_recorded". */
  action: string;
  /** Tipo da entidade afetada, ex: "receivable". */
  entityType: string;
  /** ID da entidade. NULL pra eventos sem alvo (ex: bulk pre-INSERT). */
  entityId?: string | null;
  /** Snapshot relevante. JSONB serializável. */
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Grava 1 linha em audit_event. NÃO faz throw — falha vira logger.warn.
 * Sempre chame DENTRO de uma transação `withTenant` (o store_id no GUC
 * é necessário pra RLS WITH CHECK passar).
 */
export async function recordAuditEvent(
  tx: Tx,
  input: AuditEventInput,
): Promise<void> {
  try {
    await tx.insert(auditEventTable).values({
      storeId: input.storeId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      payload: input.payload ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (e) {
    // Audit não deve quebrar a operação principal. Log o problema
    // pra investigação posterior.
    logger.warn("audit.insert_failed", {
      err: e,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}

/**
 * Helper pra extrair IP + UA de Headers de Next request. Caller passa
 * `await headers()`. Retorna `{ ip: null, userAgent: null }` se nenhum
 * header relevante presente — audit segue.
 */
export function extractClientContext(headers: Headers): {
  ip: string | null;
  userAgent: string | null;
} {
  // Vercel: x-forwarded-for (proxy chain) ou x-real-ip. Pegamos o
  // primeiro item do x-forwarded-for (cliente original).
  const xff = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  let ip: string | null = null;
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) ip = first.slice(0, 64);
  } else if (realIp) {
    ip = realIp.slice(0, 64);
  }
  const ua = headers.get("user-agent");
  const userAgent = ua ? ua.slice(0, 500) : null;
  return { ip, userAgent };
}

