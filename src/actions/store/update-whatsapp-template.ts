"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_TEMPLATE_LENGTH = 2000;

const updateTemplateSchema = z.object({
  // null/empty = volta pro default do sistema.
  template: z
    .string()
    .max(MAX_TEMPLATE_LENGTH, `Máximo ${MAX_TEMPLATE_LENGTH} caracteres.`)
    .nullable(),
});

export type UpdateTemplateInput = z.input<typeof updateTemplateSchema>;
export type UpdateTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Atualiza o template WhatsApp customizado da loja (Onda 6 — 2026-05-13).
 *
 * Aceita null/empty pra resetar pro default do sistema. Validação leve —
 * o builder de mensagem é tolerante a placeholders ausentes; lojista
 * pode usar só {cliente}+{total} se quiser uma mensagem mínima.
 */
export async function updateWhatsAppTemplate(
  input: UpdateTemplateInput,
): Promise<UpdateTemplateResult> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Entrada inválida.",
    };
  }

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  // Normaliza: trim + null pra empty (lê de volta o default).
  const normalized =
    parsed.data.template == null || parsed.data.template.trim().length === 0
      ? null
      : parsed.data.template;

  try {
    await withTenant(store.id, userId, async (tx) => {
      await tx
        .update(storeTable)
        .set({ whatsappTemplate: normalized })
        .where(eq(storeTable.id, store.id));
    });
  } catch (e) {
    logger.error("store.update_whatsapp_template.failed", {
      err: e,
      storeId: store.id,
    });
    return { ok: false, error: "Falha ao salvar template." };
  }

  revalidatePath("/admin/configuracoes");

  return { ok: true };
}
