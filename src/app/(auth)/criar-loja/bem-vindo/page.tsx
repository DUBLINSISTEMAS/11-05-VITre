"use client";

import { ArrowRightIcon, CheckIcon, CopyIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { clientEnv } from "@/lib/env-client";

const APP_URL_HOST =
  clientEnv.APP_URL
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "") || "mangospay.app";

const APP_URL_FULL =
  clientEnv.APP_URL.replace(/\/$/, "") || "https://mangospay.app";

export default function BemVindoPage() {
  return (
    <Suspense fallback={<WelcomeSkeleton />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeSkeleton() {
  return (
    <OnboardingShell step={4} hideSignInLink hideStepper>
      <div className="flex items-center justify-center py-20">
        <div className="bg-bg-app size-8 animate-pulse rounded-full" />
      </div>
    </OnboardingShell>
  );
}

function WelcomeContent() {
  const searchParams = useSearchParams();
  const storeNameRaw = searchParams.get("nome")?.trim() ?? "";
  const storeSlug = searchParams.get("slug") || "";
  const firstWord = storeNameRaw ? storeNameRaw.split(/\s+/)[0] : "";
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
    <OnboardingShell step={4} hideSignInLink hideStepper>
      <div className="text-center">
        {/* Success ring */}
        <div className="flex justify-center">
          <div
            className="flex size-[72px] items-center justify-center rounded-full shadow-md"
            style={{
              background: "var(--ok-wash)",
              color: "var(--ok)",
            }}
          >
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

        <h1 className="mt-6 text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-ink-1 sm:text-[38px]">
          Sua vitrine está no ar
          {firstWord ? (
            <>
              ,{" "}
              <span className="text-brand">{firstWord}</span>
            </>
          ) : null}
          .
        </h1>
        <p className="mx-auto mt-3.5 max-w-[520px] text-[14px] leading-[1.55] text-ink-4">
          Compartilhe esse link no Instagram, status do WhatsApp ou cartão de
          visita. Toda venda continua no seu WhatsApp.
        </p>

        {/* Link card mono */}
        <div className="mx-auto mt-8 flex max-w-[520px] items-center overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <p className="flex-1 truncate px-4 py-3.5 font-mono text-[13px] font-semibold text-left">
            {storeUrlDisplay}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-[50px] shrink-0 items-center gap-1.5 border-l border-line bg-foreground px-4 text-[12.5px] font-semibold text-background transition-colors hocus:bg-foreground/90"
            aria-label="Copiar link da vitrine"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>

        {/* Próximos passos */}
        <p className="mb-3.5 mt-14 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-4">
          Próximos passos
        </p>
        <div className="grid gap-3.5 text-left sm:grid-cols-3">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-5 outline-none transition-colors hocus:border-line-2 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <p className="font-mono text-[10.5px] font-semibold tracking-[0.05em] text-brand">
                {s.n}
              </p>
              <p className="text-[14px] font-semibold leading-tight tracking-[-0.2px] text-ink-1">
                {s.t}
              </p>
              <p className="flex-1 text-[11.5px] leading-[1.55] text-ink-4">
                {s.s}
              </p>
              <span className="mt-1.5 inline-flex items-center justify-center gap-1.5 self-start rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold transition-colors hocus:text-brand">
                {s.cta} <ArrowRightIcon className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>

        {/* CTA final */}
        <div className="mt-10">
          <Link
            href="/admin"
            className="b3-btn b3-btn--cta"
            style={{ height: 46, fontSize: 13, fontWeight: 700 }}
          >
            Ir pro painel da minha loja
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}

const NEXT_STEPS = [
  {
    n: "01",
    t: "Adicione 5 produtos",
    s: "Vitrines com pelo menos 5 produtos vendem 3× mais nos primeiros 30 dias.",
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
    s: "Banners no topo da vitrine chamam atenção pra coleções e promoções.",
    cta: "Subir banner",
    href: "/admin/banners",
  },
] as const;
