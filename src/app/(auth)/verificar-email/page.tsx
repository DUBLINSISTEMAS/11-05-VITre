"use client";

/**
 * /verificar-email — tela de "confirme seu e-mail" pós-signup.
 *
 * Bloco 4 Fase 2 (Onda 32 — 2026-05-27): cliente chega aqui após signup
 * quando `EMAIL_VERIFICATION_REQUIRED=true`. Mostra estado pendente +
 * botão de reenvio com cooldown 60s.
 *
 * O click no link do email NÃO passa por esta página — Better Auth handler
 * (em /api/auth/[...all]) confirma e redireciona pro `callbackURL` direto.
 * Esta página é só "espere o email + reenvie se preciso".
 *
 * Estado:
 *  - email vindo de ?email=X (signup passou)
 *  - cooldownLeft (segundos restantes)
 *  - sentAt (último envio bem-sucedido)
 */
import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { resendVerification } from "@/actions/auth/resend-verification";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

const COOLDOWN_SECONDS = 60;

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={<VerifySkeleton />}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifySkeleton() {
  return (
    <OnboardingShell step={1} hideSignInLink hideStepper>
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="text-ink-4 size-6 animate-spin" />
      </div>
    </OnboardingShell>
  );
}

function VerifyContent() {
  const params = useSearchParams();
  const email = params.get("email")?.trim() ?? "";
  const [isPending, startTransition] = useTransition();
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [hasSent, setHasSent] = useState(false);

  // Tick do cooldown — 1s
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setTimeout(() => setCooldownLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldownLeft]);

  const handleResend = () => {
    if (!email) {
      toast.error("E-mail não identificado. Volte ao cadastro.");
      return;
    }
    if (cooldownLeft > 0) return;
    startTransition(async () => {
      const result = await resendVerification({ email });
      if (result.ok) {
        setHasSent(true);
        setCooldownLeft(COOLDOWN_SECONDS);
        toast.success("E-mail reenviado.", {
          description: "Confira sua caixa de entrada e a pasta de spam.",
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  const maskedEmail = email
    ? email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + "•".repeat(Math.max(b.length, 3)) + c)
    : null;

  return (
    <OnboardingShell step={1} hideSignInLink hideStepper>
      <div className="text-center">
        {/* Ícone de email num círculo brand */}
        <div className="flex justify-center">
          <div
            className="flex size-[72px] items-center justify-center rounded-full shadow-md"
            style={{
              background: "var(--brand-wash)",
              color: "var(--brand)",
            }}
          >
            <MailIcon className="size-9" strokeWidth={1.8} aria-hidden />
          </div>
        </div>

        <h1 className="mt-6 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-ink-1 sm:text-[32px]">
          Confirme seu e-mail
        </h1>
        <p className="mx-auto mt-3.5 max-w-[420px] text-[14px] leading-[1.55] text-ink-3">
          Enviamos um link de confirmação{maskedEmail ? " para " : ""}
          {maskedEmail ? (
            <span className="text-ink-1 font-semibold">{maskedEmail}</span>
          ) : null}
          . Abra seu e-mail e toque no botão pra continuar.
        </p>

        {/* Dica de spam — texto pequeno discreto */}
        <p className="text-ink-4 mt-5 text-[11.5px] leading-snug">
          Não chegou em alguns minutos? Confira a pasta de spam ou peça
          o reenvio abaixo.
        </p>

        {/* CTA reenviar com cooldown */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending || cooldownLeft > 0 || !email}
            className="b3-btn"
            style={{ minWidth: 200 }}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Enviando…
              </>
            ) : cooldownLeft > 0 ? (
              <>Aguarde {cooldownLeft}s</>
            ) : hasSent ? (
              <>Reenviar e-mail</>
            ) : (
              <>Reenviar e-mail de confirmação</>
            )}
          </button>
        </div>

        {/* Link pra voltar / mudar email */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <Link
            href="/criar-loja/conta"
            className="text-ink-4 hocus:text-ink-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Cadastrar com outro e-mail
          </Link>
          <Link
            href="/entrar"
            className="text-ink-4 hocus:text-ink-1 text-[12px] font-medium transition-colors"
          >
            Já confirmei — fazer login
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
}
