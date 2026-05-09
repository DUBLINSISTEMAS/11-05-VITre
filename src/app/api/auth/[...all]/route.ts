/**
 * Catch-all do Better Auth: /api/auth/sign-in, /api/auth/sign-up,
 * /api/auth/callback/google, /api/auth/reset-password, etc.
 *
 * Toda rota de auth é gerenciada por Better Auth aqui.
 * NÃO criar rotas /api/auth/* manualmente sem entender o impacto.
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
