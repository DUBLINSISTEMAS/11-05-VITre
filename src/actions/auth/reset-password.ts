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
 * S2 (auditoria 2026-05-19): a revogacao de sessoes existentes acontece
 * automaticamente via `emailAndPassword.revokeSessionsOnPasswordReset: true`
 * em `src/lib/auth.ts`. Apos o reset bem-sucedido, TODAS as sessoes do
 * usuario sao destruidas no banco — incluindo cookies que um atacante
 * pudesse ter roubado antes do reset. O proprio usuario tem que fazer
 * login na pagina `/entrar?reset=ok`.
 *
 * O redirect aqui devolve `ok: true` + path; layout client chama signOut
 * implicitamente porque o cookie da sessao corrente tambem foi invalidado
 * server-side (`/entrar` mostra o form normalmente).
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
