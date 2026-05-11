"use client";

/**
 * Cliente Better Auth para uso no browser.
 * Re-exporta hooks usados nas páginas de auth e em componentes admin.
 *
 * Uso:
 *   import { signIn, signUp, useSession } from "@/lib/auth-client";
 *   const { data: session } = useSession();
 */
import { createAuthClient } from "better-auth/react";

import { clientEnv } from "@/lib/env-client";

export const authClient = createAuthClient({
  baseURL: clientEnv.APP_URL,
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
