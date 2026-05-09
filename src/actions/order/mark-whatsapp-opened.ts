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
import { PUBLIC_ORDER_TOKEN_LENGTH } from "@/lib/public-order";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { ANON_USER_ID, withTenant } from "@/lib/tenant";

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

  // Cliente final anônimo: passa pelo GUC `app.current_user_id = 'anonymous'`.
  // A policy `order_public_mark_whatsapp_opened` permite o UPDATE escopado a
  // este campo desde que o caller saiba o publicToken (prova de posse).
  try {
    await withTenant("", ANON_USER_ID, async (tx) => {
      await tx
        .update(orderTable)
        .set({ whatsappOpenedAt: new Date() })
        .where(eq(orderTable.publicToken, parsed.data.publicToken));
    });
    return { ok: true };
  } catch {
    // Fail-soft: cliente já está sendo redirecionado pro WhatsApp.
    return { ok: false };
  }
}
