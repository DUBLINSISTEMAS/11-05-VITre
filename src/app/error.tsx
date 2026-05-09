"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Error boundary global. Captura erros não-tratados de Server e Client Components.
 * Mostra mensagem amigável + botão de retry (`reset`).
 *
 * NOTA: Esta tela é client-side, então `logger.error` aqui escreve no console
 * do BROWSER do usuário — Vercel não captura logs de client. Erros de Server
 * Components que cascatearam pra cá já foram logados no servidor pelo runtime
 * Next; o log abaixo serve pra debug local + futura integração com observabilidade
 * client-side (Sentry browser SDK / Vercel Insights).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("ui.global_error_boundary", { digest: error.digest, err: error });
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="space-y-2">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
          Erro inesperado
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Algo deu errado
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Tente novamente em instantes. Se o problema continuar, recarregue a
          página ou volte mais tarde.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </main>
  );
}
