"use server";

/**
 * Server action — envia feedback do lojista pro time Mangos via Resend.
 * Handoff Passo 14 (2026-05-25).
 *
 * Não persiste em DB (zero schema change) — vai direto pro inbox de
 * suporte@mangospay.app (ou env.FEEDBACK_TO_EMAIL). Reply-to do
 * lojista pra responder fechar o loop.
 *
 * Rate limit: rateLimits.mutation (60/min por usuário). Spam massivo
 * inviabilizado mesmo com endpoint exposto. Sem nome de tabela = sem
 * IDOR possível.
 */

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { sendFeedbackEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { checkRateLimit, RateLimitError, rateLimits } from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/store-context";

const submitFeedbackSchema = z.object({
  type: z.enum(["idea", "bug", "feature", "praise"]),
  message: z
    .string()
    .min(8, "Conta com pelo menos 8 caracteres pra a gente entender.")
    .max(4000, "Máximo de 4000 caracteres."),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitFeedback(
  raw: unknown,
): Promise<SubmitFeedbackResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Entre de novo." };
  }

  try {
    await checkRateLimit(rateLimits.mutation, session.user.id);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        error: "Muitos feedbacks em pouco tempo. Espera um minuto.",
      };
    }
    throw err;
  }

  const parsed = submitFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return { ok: false, error: "Loja não encontrada." };
  }

  try {
    await sendFeedbackEmail({
      fromOwnerName: session.user.name ?? "Lojista",
      fromOwnerEmail: session.user.email,
      storeName: store.name,
      storeSlug: store.slug,
      type: parsed.data.type,
      message: parsed.data.message.trim(),
    });
    logger.info("admin.feedback.sent", {
      userId: session.user.id,
      storeId: store.id,
      type: parsed.data.type,
      messageLength: parsed.data.message.length,
    });
    return { ok: true };
  } catch (err) {
    logger.error("admin.feedback.send_failed", { err });
    return {
      ok: false,
      error: "Não conseguimos enviar agora. Tenta de novo em instantes.",
    };
  }
}
