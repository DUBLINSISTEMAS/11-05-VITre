"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkRateLimit, getClientIp, RateLimitError,rateLimits } from "@/lib/rate-limit";

import { extractAuthErrorCode, translateAuthError } from "./_translate-error";
import { type SignUpInput,signUpSchema } from "./schema";

export type SignUpResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Cria conta de lojista (role `store_owner` por default da coluna).
 * - Valida via Zod
 * - Rate limit por IP (rateLimits.auth)
 * - Better Auth signUpEmail (cria session + cookie automaticamente quando
 *   `requireEmailVerification=false`; quando true, cria user mas sem session
 *   até verificação)
 * - Redirect condicional:
 *     - sem email verification → `/criar-loja/identidade` (fluxo direto)
 *     - com email verification → `/verificar-email?email={email}` (espera click)
 */
export async function signUpStoreOwner(input: SignUpInput): Promise<SignUpResult> {
  let parsed: SignUpInput;
  try {
    parsed = signUpSchema.parse(input);
  } catch {
    return { ok: false, error: "Dados inválidos. Confira os campos." };
  }

  const requestHeaders = await headers();

  try {
    await checkRateLimit(rateLimits.auth, getClientIp(requestHeaders));
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.email,
        password: parsed.password,
        name: parsed.name,
        // Bloco 4 Fase 2 (Onda 32): quando verification obrigatória,
        // o link do email leva direto pro próximo passo do onboarding.
        callbackURL: "/criar-loja/identidade",
      },
      headers: requestHeaders,
    });
    // Bloco 4 Fase 2: redirect condicional baseado no flag.
    const redirectTo = env.EMAIL_VERIFICATION_REQUIRED
      ? `/verificar-email?email=${encodeURIComponent(parsed.email)}`
      : "/criar-loja/identidade";
    return { ok: true, redirectTo };
  } catch (e: unknown) {
    return { ok: false, error: translateAuthError(extractAuthErrorCode(e)) };
  }
}
