"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCcwIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "storefront", digest: error.digest ?? "no-digest" },
    });
  }, [error]);

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
