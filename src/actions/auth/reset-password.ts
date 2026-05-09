"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RateLimitError,rateLimits } from "@/lib/rate-limit";

import { extractAuthErrorCode, translateAuthError } from "./_translate-error";
import { type ResetPasswordInput,resetPasswordSchema } from "./schema";

export type ResetPasswordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Conclui o reset de senha com token + nova senha.
 * Better Auth invalida o token após o uso (1 chance).
 *
 * TODO Fase 2: revogar todas as outras sessões ativas após reset
 * (proteção contra atacante com cookie roubado pré-reset). Hoje cookie
 * sessão expira em 30d — risco aceitável no MVP, mas documentado.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  let parsed: ResetPasswordInput;
  try {
    parsed = resetPasswordSchema.parse(input);
  } catch {
    return { ok: false, error: "Dados inválidos." };
  }

  const requestHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.auth, getClientIp(requestHeaders));
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: parsed.password,
        token: parsed.token,
      },
      headers: requestHeaders,
    });
    return { ok: true, redirectTo: "/entrar?reset=ok" };
  } catch (e: unknown) {
    return { ok: false, error: translateAuthError(extractAuthErrorCode(e)) };
  }
}
