"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RateLimitError,rateLimits } from "@/lib/rate-limit";

import { type RequestPasswordResetInput,requestPasswordResetSchema } from "./schema";

export type RequestPasswordResetResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Solicita reset de senha. Better Auth gera token e dispara email via Resend
 * (configurado em src/lib/auth.ts via sendResetPassword).
 *
 * IMPORTANTE: por segurança, não diferenciamos no retorno se o email existe
 * ou não — sempre `ok: true`. Evita enumeração de usuários.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  let parsed: RequestPasswordResetInput;
  try {
    parsed = requestPasswordResetSchema.parse(input);
  } catch {
    return { ok: false, error: "Email inválido." };
  }

  const requestHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.auth, getClientIp(requestHeaders));
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.email,
        redirectTo: "/redefinir",
      },
      headers: requestHeaders,
    });
  } catch {
    // Silenciamos erro propositalmente — não vazar se email existe
  }

  return { ok: true };
}
