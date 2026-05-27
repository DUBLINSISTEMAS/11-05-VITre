"use server";

/**
 * Reenvia o email de verificação pra um endereço.
 *
 * Bloco 4 Fase 2 (Onda 32 — 2026-05-27): usado pela página `/verificar-email`
 * quando o lojista perde o email original (filtro spam, fechou aba antes
 * de clicar). Cooldown de 60s do lado client + rate limit `auth` server-side
 * (5 reqs / 10min por IP).
 *
 * Comportamento defensivo:
 *  - Sempre retorna {ok:true} sem expor se o email existe (anti-enumeration)
 *  - Erros internos logam mas não vazam pro cliente
 *  - Email só é REALMENTE enviado se user existe E não está verified
 */
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";

const inputSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export type ResendVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resendVerification(input: {
  email: string;
}): Promise<ResendVerificationResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "E-mail inválido." };
  }

  const requestHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.auth, getClientIp(requestHeaders));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  try {
    // Better Auth handler — se o user existe E não está verified, envia;
    // se já verificado ou inexistente, retorna ok silenciosamente.
    await auth.api.sendVerificationEmail({
      body: {
        email: parsed.data.email,
        callbackURL: "/criar-loja/identidade",
      },
      headers: requestHeaders,
    });
  } catch (err) {
    logger.warn("auth.resend_verification_failed", {
      err,
      email: parsed.data.email,
    });
    // Anti-enumeration: mesmo se Better Auth falhar (email inexistente
    // ou throw qualquer), retorna ok pra não vazar quem tem conta.
  }

  return { ok: true };
}
