"use server";

/**
 * Atualiza `whatsappOpenedAt` do pedido — analytics + state machine.
 *
 * NÃO é crítico: cliente clica WhatsApp e é redirecionado mesmo se a
 * action falhar. Useful pra Sandra ver % de pedidos que efetivamente
 * abriram conversa (vs. abandonaram no /sucesso).
 *
 * Idempotente — múltiplos clicks só atualizam o timestamp pro mais
 * recente.
 *
 * Sem rate limit dedicado (baixo volume + idempotente). Bucket
 * `publicApi` cobre flood improvável de bots.
 */
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { orderTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import { PUBLIC_ORDER_TOKEN_LENGTH } from "@/lib/public-order";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { ANON_USER_ID, withServiceRole, withTenant } from "@/lib/tenant";

const inputSchema = z.object({
  publicToken: z
    .string()
    .trim()
    .length(PUBLIC_ORDER_TOKEN_LENGTH)
    .regex(/^[A-Za-z0-9_-]+$/, "Token inválido"),
});

export interface MarkWhatsAppOpenedResult {
  ok: boolean;
}

export async function markWhatsAppOpened(input: {
  publicToken: string;
}): Promise<MarkWhatsAppOpenedResult> {
  try {
    const headerList = await headers();
    await checkRateLimit(rateLimits.publicApi, getClientIp(headerList));
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false };
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  // Gate C2 da auditoria 2026-05-11: resolver storeId real ANTES do UPDATE
  // em vez de passar withTenant("", ...). A policy atual
  // `order_public_mark_whatsapp_opened` (SQL 10) só checa
  // `current_user_id = 'anonymous'`, então withTenant("", ...) funciona "por
  // acidente" — mas se a policy ganhar `store_id = current_setting(...)` no
  // WITH CHECK depois, o UPDATE quebra silencioso. Isolamento tenant real
  // protege.
  try {
    const order = await withServiceRole<{ storeId: string } | null>(
      "mark-whatsapp-opened: resolve storeId by publicToken (anon)",
      async (tx) => {
        const rows = await tx
          .select({ storeId: orderTable.storeId })
          .from(orderTable)
          .where(eq(orderTable.publicToken, parsed.data.publicToken))
          .limit(1);
        return rows[0] ?? null;
      },
    );

    if (!order) return { ok: false };

    await withTenant(order.storeId, ANON_USER_ID, async (tx) => {
      await tx
        .update(orderTable)
        .set({ whatsappOpenedAt: new Date() })
        .where(eq(orderTable.publicToken, parsed.data.publicToken));
    });
    return { ok: true };
  } catch (err) {
    // Fail-soft: cliente já está sendo redirecionado pro WhatsApp.
    // Logar pra investigação (M6 da auditoria — catches silenciosos cegam o
    // founder em prod).
    logger.error("order.mark_whatsapp_opened_failed", { err });
    return { ok: false };
  }
}
