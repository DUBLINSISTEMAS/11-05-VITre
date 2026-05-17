// Shell do onboarding — Port Dublin v3 (ADR-0019, Onda A.4).
//
// Card centralizado max-w-880 sobre `--bg-app`, com:
// - Header: logo Vitrê + link "PULAR" opcional (vai pra /admin direto)
// - Stepper horizontal: N circles numerados + linhas conectoras
//   (verde quando completo, brand quando atual, line-2 quando futuro)
// - Body slot (children) com padding 36px 48px
// - Footer opcional (`footerLeft` + `footerRight`) com background bg-app
//   e padding 18px 32px — fica destacado do body (border-top --line)
//
// Tela /bem-vindo passa `hideStepper` pra mostrar só logo + body.
//
// Replica B3OnboardingScreen do handoff `bagy-sprint-e.jsx` linhas 41-136.
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface OnboardingShellProps {
  /** Passo atual (1-indexed). */
  step: number;
  /** Total de passos. Default 4 (Vitrê: conta → identidade → tipo de negócio → bem-vindo). */
  total?: number;
  /**
   * Esconde o link "Já tenho conta · entrar". Default false.
   * Tela 4 (bem-vindo) usa hideSignInLink + hideStepper.
   */
  hideSignInLink?: boolean;
  /** Esconde o stepper (usado em /bem-vindo). Default false. */
  hideStepper?: boolean;
  /** Conteúdo do slot esquerdo do footer (geralmente botão Voltar). */
  footerLeft?: ReactNode;
  /** Conteúdo do slot direito do footer (botão Continuar/Criar). */
  footerRight?: ReactNode;
  children: ReactNode;
}

export function OnboardingShell({
  step,
  total = 4,
  hideSignInLink = false,
  hideStepper = false,
  footerLeft,
  footerRight,
  children,
}: OnboardingShellProps) {
  const stepLabels = STEP_LABELS_4;
  const labels = total === stepLabels.length ? stepLabels : Array.from({ length: total }, (_, i) => `Passo ${i + 1}`);

  return (
    <div className="bg-bg-app flex min-h-dvh items-center justify-center px-4 py-8 sm:px-8">
      <div className="bg-surface w-full max-w-[880px] overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(15,20,25,0.25)]">
        {/* ───── Header ───── */}
        <header className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-8">
          <Link
            href="/"
            aria-label="Vitrê"
            className="hocus:text-brand text-ink-1 inline-flex items-center gap-2.5 transition-colors"
          >
            <VitreLogoMark />
            <span className="text-[17px] font-bold tracking-[-0.4px]">Vitrê</span>
          </Link>

          {hideSignInLink ? null : (
            <Link
              href="/entrar"
              className="text-ink-4 hocus:text-ink-1 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors"
            >
              Já tenho conta
            </Link>
          )}
        </header>

        {/* ───── Stepper ───── */}
        {hideStepper ? null : (
          <div className="bg-bg-app flex items-center gap-1 border-b border-line px-4 py-4 sm:px-8">
            {labels.map((label, i) => {
              const idx = i + 1; // 1-indexed
              const isActive = idx === step;
              const isComplete = idx < step;
              return (
                <Step
                  key={label}
                  index={idx}
                  label={label}
                  isActive={isActive}
                  isComplete={isComplete}
                  isLast={idx === total}
                />
              );
            })}
          </div>
        )}

        {/* ───── Body ───── */}
        <div className="px-6 py-8 sm:px-12 sm:py-9">{children}</div>

        {/* ───── Footer ───── */}
        {(footerLeft || footerRight) && (
          <div className="bg-bg-app flex items-center justify-between gap-3 border-t border-line px-6 py-[18px] sm:px-8">
            <div className="flex items-center gap-2">{footerLeft}</div>
            <div className="flex items-center gap-2">{footerRight}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step circle + linha ──────────────────────────────────────────────
const STEP_LABELS_4 = ["Sua conta", "Identidade", "Tipo de negócio", "Pronto"];

interface StepProps {
  index: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
  isLast: boolean;
}

function Step({ index, label, isActive, isComplete, isLast }: StepProps) {
  return (
    <>
      <div
        className="inline-flex items-center gap-2 py-1"
        style={{
          color: isActive ? "var(--ink-1)" : isComplete ? "var(--ok)" : "var(--ink-4)",
          fontWeight: isActive ? 600 : 500,
          fontSize: 13,
        }}
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center text-[11px] font-bold"
          style={{
            width: 22,
            height: 22,
            borderRadius: 50,
            background: isActive
              ? "var(--brand)"
              : isComplete
                ? "var(--ok)"
                : "var(--bg-app)",
            border: isActive || isComplete ? "none" : "1.5px solid var(--line-2)",
            color: isActive || isComplete ? "white" : "var(--ink-4)",
            flexShrink: 0,
          }}
        >
          {isComplete ? <CheckIcon size={11} strokeWidth={3} /> : index}
        </span>
        <span className="hidden sm:inline">{label}</span>
      </div>
      {!isLast && (
        <div
          aria-hidden
          className="mx-1.5 h-0.5 flex-1"
          style={{
            background: isComplete ? "var(--ok)" : "var(--line-2)",
          }}
        />
      )}
    </>
  );
}

// ─── Logo mark — silhueta de sacola ───────────────────────────────────
function VitreLogoMark({ size = 28 }: { size?: number }) {
  const stroke = 2.4;
  return (
    <span
      aria-hidden
      className="text-primary inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.78} height={size * 0.78} fill="none">
        <path
          d="M5.5 9.5h13l-.7 9.2a2 2 0 0 1-2 1.8h-7.6a2 2 0 0 1-2-1.8L5.5 9.5Z"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d="M9 9.5V8a3 3 0 0 1 6 0v1.5"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d="M9 14.2c1.3 1.6 4.7 1.6 6 0"
          stroke="currentColor"
          strokeWidth={stroke - 0.2}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
