"use client";

/**
 * Error boundary do segmento (admin).
 *
 * Captura qualquer throw em RSC/action dentro de /admin/* (falha de query
 * Drizzle, pool exausto, race em withTenant, erro inesperado de action).
 * Sem este boundary, qualquer erro sobe pra _error global do Next e a
 * lojista vê uma tela genérica em inglês, sem opção de retry.
 *
 * Por que está no nível do segmento (admin)/admin:
 *   - Cobre TODAS as rotas filhas (produtos, pedidos, categorias, …).
 *   - Mantém o shell do admin (sidebar, header) — não precisa relogar.
 *
 * Deve ser Client Component (regra do Next App Router pra error boundaries).
 *
 * Sentry (T1-3): `captureException` reporta com tag `boundary: admin` pra
 * separar dos erros de outras zonas. `digest` do Next vai como tag extra.
 */
import * as Sentry from "@sentry/nextjs";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "admin", digest: error.digest ?? "no-digest" },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangleIcon className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Algo deu errado por aqui</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          A gente já registrou o problema. Tenta de novo — se persistir,
          recarrega a página ou volta pro painel.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground/70 mt-2 font-mono text-[10px]">
            ref: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()} className="gap-2">
          <RotateCcwIcon className="size-4" /> Tentar de novo
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin">Voltar pro painel</Link>
        </Button>
      </div>
    </div>
  );
}
