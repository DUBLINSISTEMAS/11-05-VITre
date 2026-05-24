"use server";

/**
 * submitContactMessage — Sprint 5.2 (2026-05-22).
 *
 * Formulário público de contato no storefront (/[storeSlug]/contato).
 * Aqui o cliente preenche nome + telefone + mensagem livre e o lojista
 * vê em /admin/contatos.
 *
 * Anon-callable (anti-spoofing por storeSlug resolvido server-side
 * via getStoreBySlug, rate limit por IP).
 */
import { headers } from "next/headers";
import { z } from "zod";

import { leadTable } from "@/db/schema";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import { withServiceRole } from "@/lib/tenant";
import { isValidWhatsAppBR, parseWhatsAppBR } from "@/lib/whatsapp-format";

const inputSchema = z.object({
  storeSlug: z.string().min(1).max(64),
  customerName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(80, "Nome muito longo."),
  customerPhone: z
    .string()
    .trim()
    .refine(isValidWhatsAppBR, "Número de WhatsApp inválido."),
  // Mensagem é gravada em `lead.notes`. Limite simétrico aos outros
  // text livre da loja (customer.notes etc).
  message: z.string().trim().min(3, "Escreva sua mensagem.").max(500),
});

export type SubmitContactMessageInput = z.input<typeof inputSchema>;

export type SubmitContactMessageResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitContactMessage(
  input: SubmitContactMessageInput,
): Promise<SubmitContactMessageResult> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  // Resolve loja por slug — bloqueia spoofing de storeId direto.
  const store = await getStoreBySlug(data.storeSlug);
  if (!store) {
    // Mensagem genérica — não confirma se slug existe.
    return { ok: false, error: "Loja indisponível." };
  }

  // Rate limit por IP+store. Bucket separado pra não competir com
  // createOrder do mesmo cliente clicando no WhatsApp.
  try {
    await checkRateLimit(
      rateLimits.createOrder,
      ip === null ? null : `contact:${ip}:${store.id}`,
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        error: "Muitas mensagens em pouco tempo. Tente daqui a alguns minutos.",
      };
    }
    throw err;
  }

  let phoneE164: string;
  try {
    phoneE164 = parseWhatsAppBR(data.customerPhone).e164;
  } catch {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: {
        customerPhone: "Número de WhatsApp inválido.",
      },
    };
  }

  try {
    await withServiceRole(
      "submitContactMessage — formulário público anônimo",
      async (tx) => {
        await tx.insert(leadTable).values({
          storeId: store.id,
          productId: null,
          customerName: data.customerName,
          customerPhone: phoneE164,
          productSnapshot: null,
          source: "contact_form" as const,
          status: "new",
          notes: data.message,
        });
      },
    );
    logger.info("contact_form.submitted", {
      storeId: store.id,
      hasPhone: true,
    });
    return { ok: true };
  } catch (e) {
    logger.warn("contact_form.submit_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: "Falha ao enviar mensagem. Tente novamente em alguns instantes.",
    };
  }
}
