import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Placeholder da home pública (rota /).
 * Será substituído por landing de marketing na Fase 3.
 * No MVP, redirecionamos visitantes pra /entrar (lojista) ou exibimos um stub.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-8">
        <Image
          src="/brand/logo-principal.webp"
          alt="Vitrê"
          width={120}
          height={120}
          priority
          className="rounded-2xl"
        />

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Catálogo digital com checkout WhatsApp
          </h1>
          <p className="text-base text-muted-foreground">
            Em construção. Sandra Brito Collection será a primeira loja a entrar no ar.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/entrar">Acessar painel</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/criar-loja/conta">Criar minha loja</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          MVP em desenvolvimento — não compartilhe ainda.
        </p>
      </div>
    </main>
  );
}
