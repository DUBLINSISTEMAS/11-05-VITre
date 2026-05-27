"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCcwIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Captura com contexto rico — onda 4 redesign 2026-05-26.
    // Antes só registrava `boundary: "storefront"` + digest. Em
    // diagnóstico cego sem repro local, era impossível saber qual
    // loja, qual rota, qual user agent. Agora cada captura traz
    // tudo que precisa pra triagem em <30s no Sentry.
    Sentry.captureException(error, {
      tags: {
        boundary: "storefront",
        digest: error.digest ?? "no-digest",
        pathname: pathname ?? "unknown",
      },
      contexts: {
        storefront_error: {
          message: error.message,
          name: error.name,
          // `digest` redact mensagem em prod (Next.js). Em dev mostra.
          stack: error.stack?.split("\n").slice(0, 8).join("\n"),
          url:
            typeof window !== "undefined" ? window.location.href : undefined,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Debug visível em prod (console do cliente) — founder pode F12
    // e copiar quando reproduzir, em vez de depender só do Sentry.
    console.error("[storefront.error]", {
      message: error.message,
      digest: error.digest,
      pathname,
      stack: error.stack,
    });
  }, [error, pathname]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Não conseguimos carregar a loja</h1>
        <p className="text-muted-foreground text-sm">
          Verifique sua conexão e tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground/70 mt-2 font-mono text-[10px]">
            ref: {error.digest}
          </p>
        ) : null}
      </div>
      <Button type="button" onClick={reset} className="gap-2">
        <RotateCcwIcon className="size-4" /> Tentar novamente
      </Button>
    </main>
  );
}
