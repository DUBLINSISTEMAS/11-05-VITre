/**
 * Sentry — bootstrap client browser.
 *
 * Lê `process.env.NEXT_PUBLIC_SENTRY_DSN` (precisa do prefixo NEXT_PUBLIC_
 * pra Next embedar no bundle do client). Sem DSN → no-op.
 *
 * Decisões:
 *   - Sem Session Replay: Free tier dá 50 replays/mês, não compensa pra
 *     5-20 lojas. Reabrir se notar bug recorrente impossível de reproduzir.
 *   - Sem Performance/Tracing: `tracesSampleRate: 0`. Mesma razão do server.
 *   - `sendDefaultPii: false`: idem server.
 *
 * Ref: production-readiness-tier1 / T1-3.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    integrations: [], // sem replay/feedback widget no MVP
    ignoreErrors: [
      "ResizeObserver loop completed", // ruído conhecido de browsers Chrome
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured", // erros não-Error genéricos
    ],
  });
}

/**
 * Hook Next 15 que reporta erros durante navegação RSC client-side.
 * Exportado conforme docs Sentry v10+.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
