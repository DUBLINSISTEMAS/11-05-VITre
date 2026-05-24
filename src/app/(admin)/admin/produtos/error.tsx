"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "admin-products", digest: error.digest ?? "no-digest" },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangleIcon className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Produtos indisponíveis</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Não foi possível carregar o catálogo agora.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset} className="gap-2">
          <RotateCcwIcon className="size-4" /> Tentar novamente
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin">Voltar pro painel</Link>
        </Button>
      </div>
    </div>
  );
}
