/**
 * Sentry — bootstrap server + edge runtime.
 *
 * Convenções deste arquivo:
 *   - Lê `process.env.SENTRY_DSN` direto (não via `@/lib/env`): instrumentation
 *     roda ANTES do Next bootstrap, env validation com Zod ainda não está
 *     pronta. Se DSN ausente → no-op silencioso (dev local sem config).
 *   - `sendDefaultPii: false`: Vitrê NÃO permite Sentry capturar headers de
 *     request, cookies, request body. Erros vão sem PII por default.
 *   - `tracesSampleRate: 0`: tracing desligado por hora (Free tier tem
 *     limite separado de traces). Pode ativar gradativo se notar
 *     necessidade de p95 por rota.
 *   - `onRequestError`: hook Next 15 que captura erros de RSC + route
 *     handlers + server actions automaticamente. Exportado conforme docs
 *     Sentry v10+.
 *
 * Ref: production-readiness-tier1 / T1-3.
 */
import * as Sentry from "@sentry/nextjs";

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Dev local sem DSN — Sentry vira no-op.
    // Em prod (Vercel), env var ausente é problema de config, não bug.
    return;
  }
  // Desliga Sentry em `pnpm dev` mesmo com DSN configurado.
  // Warnings de PropTypes / RSC boundary do Next 15 turbopack são DEV-only
  // (strippados em prod) e enchiam a cota Free (5k/mês) com ruído que não
  // afeta o usuário final. Override com `SENTRY_FORCE_DEV=1` se precisar
  // debugar localmente.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.SENTRY_FORCE_DEV !== "1"
  ) {
    return;
  }

  const baseConfig: Sentry.NodeOptions = {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0, // desligado — Free tier tracing tem cota separada.
    sendDefaultPii: false,
    // `ignoreErrors`: ruído conhecido que não vale gastar cota Free (5k/mês).
    ignoreErrors: [
      "AbortError", // fetch abortado pelo cliente (next/navigation)
      "NEXT_REDIRECT", // redirect() do Next não é erro real
      "NEXT_NOT_FOUND", // notFound() do Next não é erro real
    ],
  };

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(baseConfig);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(baseConfig);
  }
}

/**
 * Captura erros lançados durante RSC, route handlers e server actions.
 * Next 15 invoca este hook automaticamente quando exportado.
 */
export const onRequestError = Sentry.captureRequestError;
