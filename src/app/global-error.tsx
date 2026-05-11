"use client";

/**
 * Global error boundary — catch-all do App Router.
 *
 * Captura erros que escapam dos error.tsx específicos de cada segmento
 * (admin, storefront, etc) — geralmente erros que acontecem em layout
 * raiz ou no próprio root.tsx. Renderiza HTML + body próprios (regra do
 * Next: global-error substitui o root layout em catástrofe).
 *
 * Sentry (T1-3): captura com tag `boundary: global` pra separar dos erros
 * dos boundaries específicos. Esses erros são RAROS mas críticos —
 * geralmente indicam config quebrada (env var, build artifact ausente).
 *
 * Ref: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global", digest: error.digest ?? "no-digest" },
      level: "fatal",
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        {/* NextError é o componente built-in do Next pra páginas de erro;
            mais simples que tentar replicar shell completo aqui, e cobre o
            caso "tudo quebrou" honestamente. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
