import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Landing pública (rota /). Mobile-first.
 *
 * Vitrê = vitrine digital com checkout via WhatsApp pra pequenas lojas
 * de moda, joia, semijoia e perfumaria. Sem gateway próprio — a venda
 * continua acontecendo no WhatsApp do lojista, a vitrine só organiza
 * produto, preço e link.
 *
 * Sem promessas de feature que ainda não existe.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Topbar minimal */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo-principal.webp"
              alt="Vitrê"
              width={28}
              height={28}
              priority
              className="rounded-md"
            />
            <span className="text-[15px] font-semibold tracking-[-0.3px]">
              Vitrê
            </span>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-9 text-[13px]">
            <Link href="/entrar">Entrar</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
          <p className="text-primary mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em]">
            Vitrine digital · Checkout WhatsApp
          </p>

          <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-1px] sm:text-[48px] sm:tracking-[-1.4px]">
            Sua vitrine digital,
            <br />
            <span className="text-muted-foreground">vendendo pelo WhatsApp.</span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-xl text-[15px] leading-[1.55] sm:text-base">
            Pequenas lojas de moda, joia, semijoia e perfumaria organizam
            a vitrine num link só. O cliente escolhe, fecha o pedido, e
            a conversa cai direto no seu WhatsApp.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 h-12 gap-1.5 px-6 text-[14px] font-semibold shadow-md sm:h-[50px]"
            >
              <Link href="/criar-loja/conta">
                Criar minha loja
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-6 text-[14px] font-semibold sm:h-[50px]"
            >
              <Link href="/entrar">Já tenho conta</Link>
            </Button>
          </div>

          {/* Three-up de benefícios sem inventar feature */}
          <div className="mt-14 grid gap-5 sm:mt-20 sm:grid-cols-3 sm:gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-1.5">
                <p className="text-primary font-mono text-[10px] font-semibold tracking-[0.06em]">
                  {f.kicker}
                </p>
                <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.2px]">
                  {f.title}
                </h2>
                <p className="text-muted-foreground text-[13px] leading-[1.55]">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© Vitrê</p>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    kicker: "01",
    title: "Vitrine num link",
    body: "Cadastre produtos, preço e foto. Compartilha um link só no Instagram, status do WhatsApp ou cartão.",
  },
  {
    kicker: "02",
    title: "Pedido cai no WhatsApp",
    body: "Cliente monta a sacola, confirma, e a conversa abre no seu WhatsApp com tudo já preenchido.",
  },
  {
    kicker: "03",
    title: "Sem gateway, sem taxa",
    body: "Você cobra como já cobra hoje. A Vitrê só organiza a vitrine — quem vende continua sendo você.",
  },
] as const;
