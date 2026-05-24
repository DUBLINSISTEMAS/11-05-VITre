"use client";

/**
 * Cliente Better Auth para uso no browser.
 * Re-exporta apenas o que é consumido por componentes client.
 */
import { createAuthClient } from "better-auth/react";

import { clientEnv } from "@/lib/env-client";

const authClient = createAuthClient({
  baseURL: clientEnv.APP_URL,
});

export const { signOut } = authClient;
