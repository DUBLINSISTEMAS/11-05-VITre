// Shell do onboarding canvas-v1 — header com Vitrê wordmark + barra de
// progresso (PASSO N DE M mono + percentual + bar tinta brand) + link
// "Já tenho conta · entrar". Children abaixo (passa-pra-baixo livre).
//
// Canvas: linhas 3-28 do _vitre-onboarding.jsx.
//
// Server-component-friendly (sem state). Cada page passa `step` 1/2/3.
import Link from "next/link";

interface OnboardingShellProps {
  /** Passo atual (1-indexed). */
  step: number;
  /** Total de passos. Default 4 (Dublin v3: conta → identidade → tipo de negócio → bem-vindo). */
  total?: number;
  /**
   * Esconde o link "Já tenho conta · entrar" (tela 4 já não faz sentido —
   * usuária já tem conta e está logada).
   */
  hideSignInLink?: boolean;
  children: React.ReactNode;
}

export function OnboardingShell({
  step,
  total = 4,
  hideSignInLink = false,
  children,
}: OnboardingShellProps) {
  const percent = Math.round((step / total) * 100);

  return (
    <div className="bg-background grid min-h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center gap-4 border-b px-6 py-4 sm:gap-8 sm:px-8 sm:py-[18px]">
        <Link
          href="/"
          aria-label="Vitrê"
          className="hocus:text-primary text-foreground inline-flex shrink-0 items-center gap-2 transition-colors"
        >
          <VitreLogoMark />
          <span className="text-[16px] font-semibold tracking-[-0.4px]">
            Vitrê
          </span>
        </Link>

        <div className="hidden flex-1 sm:block sm:max-w-[380px]">
          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span className="font-mono uppercase tracking-[0.04em]">
              Passo {step} de {total}
            </span>
            <span className="font-mono tabular-nums">{percent}%</span>
          </div>
          <div className="bg-muted mt-1.5 h-[3px] overflow-hidden rounded-sm">
            <div
              className="bg-primary h-full transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Mobile: progress compacto sem labels */}
        <div className="bg-muted relative h-[3px] flex-1 overflow-hidden rounded-sm sm:hidden">
          <div
            className="bg-primary h-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {hideSignInLink ? null : (
          <Link
            href="/entrar"
            className="text-muted-foreground hocus:text-foreground hidden text-[12px] transition-colors sm:ml-auto sm:inline"
          >
            Já tenho conta · entrar
          </Link>
        )}
      </header>

      {children}
    </div>
  );
}

// ─── Logo mark — silhueta de sacola (canvas linha "VTLogoMark") ──────
function VitreLogoMark({ size = 24 }: { size?: number }) {
  const stroke = 2.4;
  return (
    <span
      aria-hidden
      className="text-primary inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.78}
        height={size * 0.78}
        fill="none"
      >
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
