"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RateLimitError,rateLimits } from "@/lib/rate-limit";

import { extractAuthErrorCode, translateAuthError } from "./_translate-error";
import { type SignInInput,signInSchema } from "./schema";

export type SignInResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Login do lojista. Better Auth seta cookie de sessão automaticamente.
 * Redireciona para `/admin`.
 */
export async function signInWithEmail(input: SignInInput): Promise<SignInResult> {
  let parsed: SignInInput;
  try {
    parsed = signInSchema.parse(input);
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
    await auth.api.signInEmail({
      body: {
        email: parsed.email,
        password: parsed.password,
      },
      headers: requestHeaders,
    });
    return { ok: true, redirectTo: "/admin" };
  } catch (e: unknown) {
    return { ok: false, error: translateAuthError(extractAuthErrorCode(e)) };
  }
}
