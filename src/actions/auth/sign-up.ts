"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
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
 * - Better Auth signUpEmail (cria session + cookie automaticamente)
 * - Redireciona para `/criar-loja/identidade` (Bloco D do onboarding)
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
      },
      headers: requestHeaders,
    });
    return { ok: true, redirectTo: "/criar-loja/identidade" };
  } catch (e: unknown) {
    return { ok: false, error: translateAuthError(extractAuthErrorCode(e)) };
  }
}
