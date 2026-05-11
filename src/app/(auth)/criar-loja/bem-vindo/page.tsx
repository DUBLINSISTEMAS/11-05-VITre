"use client";

import { ArrowRightIcon, CheckIcon, CopyIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/env-client";

const APP_URL_HOST =
  clientEnv.APP_URL
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "") || "vitre.app";

const APP_URL_FULL =
  clientEnv.APP_URL.replace(/\/$/, "") || "https://vitre.app";

export default function BemVindoPage() {
  return (
    <Suspense fallback={<WelcomeSkeleton />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeSkeleton() {
  return (
    <OnboardingShell step={3} hideSignInLink>
      <div className="flex items-center justify-center py-20">
        <div className="bg-muted size-8 animate-pulse rounded-full" />
      </div>
    </OnboardingShell>
  );
}

function WelcomeContent() {
  const searchParams = useSearchParams();
  const storeName = searchParams.get("nome") || "Sua loja";
  const storeSlug = searchParams.get("slug") || "";
  const firstName = storeName.trim().split(" ")[0] ?? "Sandra";
  const storeUrlDisplay = `${APP_URL_HOST}/${storeSlug}`;
  const storeUrlFull = `${APP_URL_FULL}/${storeSlug}`;

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrlFull);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Não consegui copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <OnboardingShell step={3} hideSignInLink>
      <div className="overflow-y-auto px-4 py-12 sm:px-10 sm:py-[60px]">
        <div className="mx-auto max-w-[880px]">
          {/* Success ring */}
          <div className="flex justify-center">
            <div className="bg-success-soft text-success flex size-[72px] items-center justify-center rounded-full shadow-md">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="mt-6 text-center text-[32px] font-semibold leading-[1.05] tracking-[-0.8px] sm:text-[38px] sm:tracking-[-1px]">
            Sua loja está no ar,{" "}
            <span className="text-primary">{firstName}</span>.
          </h1>
          <p className="text-muted-foreground mx-auto mt-3.5 max-w-[520px] text-center text-[14px] leading-[1.55]">
            Compartilhe esse link no Instagram, status do WhatsApp ou cartão de
            visita. Toda venda continua no seu WhatsApp.
          </p>

          {/* Link card mono */}
          <div className="mx-auto mt-8 flex max-w-[520px] items-center overflow-hidden rounded-xl border bg-card shadow-sm">
            <p className="flex-1 truncate px-4 py-3.5 font-mono text-[13px] font-semibold">
              {storeUrlDisplay}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="bg-foreground text-background hocus:bg-foreground/90 inline-flex h-[50px] shrink-0 items-center gap-1.5 border-l px-4 text-[12.5px] font-semibold transition-colors"
              aria-label="Copiar link da loja"
            >
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>

          {/* Próximos passos */}
          <p className="text-muted-foreground mb-3.5 mt-14 text-center font-mono text-[10px] uppercase tracking-[0.05em]">
            Próximos passos
          </p>
          <div className="grid gap-3.5 sm:grid-cols-3">
            {NEXT_STEPS.map((s) => (
              <Link
                key={s.n}
                href={s.href}
                className="bg-card hocus:border-foreground/30 flex flex-col gap-2.5 rounded-xl border p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <p className="text-primary font-mono text-[10.5px] font-semibold tracking-[0.05em]">
                  {s.n}
                </p>
                <p className="text-[14px] font-semibold leading-tight tracking-[-0.2px]">
                  {s.t}
                </p>
                <p className="text-muted-foreground flex-1 text-[11.5px] leading-[1.55]">
                  {s.s}
                </p>
                <span className="hocus:text-primary mt-1.5 inline-flex items-center justify-center gap-1.5 self-start rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors">
                  {s.cta} <ArrowRightIcon className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>

          {/* CTA final */}
          <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 h-[46px] gap-1.5 px-7 text-[13px] font-semibold shadow-md"
            >
              <Link href="/admin">
                Ir pro painel da minha loja
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}

const NEXT_STEPS = [
  {
    n: "01",
    t: "Adicione 5 produtos",
    s: "Lojas com pelo menos 5 produtos vendem 3× mais nos primeiros 30 dias.",
    cta: "Cadastrar produto",
    href: "/admin/produtos/novo",
  },
  {
    n: "02",
    t: "Configure sua loja",
    s: "Endereço, Instagram, descrição. Detalhes que ajudam a vender mais.",
    cta: "Configurar loja",
    href: "/admin/configuracoes",
  },
  {
    n: "03",
    t: "Suba seu primeiro banner",
    s: "Banners no topo da loja chamam atenção pra coleções e promoções.",
    cta: "Subir banner",
    href: "/admin/banners",
  },
] as const;
