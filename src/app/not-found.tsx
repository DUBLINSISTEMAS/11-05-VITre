import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="space-y-2">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          O endereço que você acessou não existe ou foi removido.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </main>
  );
}
