/**
 * Checklist guiado de primeiros passos — aparece no /admin quando a loja
 * está zerada (sem produtos ou sem nenhuma venda registrada). Substitui
 * os OpCards vazios ("Caixa fechado", "Sem vendas") por um guia objetivo
 * de o que fazer pra colocar a vitrine no ar.
 *
 * Cada item tem:
 *   - state `done`: ícone verde de check + texto subtle; link continua
 *     acessível pra reabrir a tela.
 *   - state `pending`: ícone com número + CTA pra ação direta.
 *
 * O cálculo de done/pending vive no parent (`/admin/page.tsx`) — este
 * componente só renderiza props prontas.
 *
 * Bloco E1 UX (2026-05-29) — `OnboardingProgressStrip` é a versão fina
 * (1 linha) pra dashboard maduro com passos pendentes. Antes o checklist
 * grande SOMIA assim que cadastrava 1 produto + 1 venda — passos 2-4
 * (logo, endereço, banner) ficavam órfãos.
 */
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

export interface ChecklistStep {
  number: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  done: boolean;
}

export interface OnboardingChecklistProps {
  storeName: string;
  steps: ChecklistStep[];
}

export function OnboardingChecklist({
  storeName,
  steps,
}: OnboardingChecklistProps) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;

  return (
    <section
      aria-label="Primeiros passos da loja"
      className="b3-card b3-card-pad"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-ink-1 text-[16px] font-bold">
            Bem-vindo{storeName ? `, ${storeName.split(/\s+/)[0]}` : ""}.
          </h2>
          <p className="text-ink-4 mt-0.5 text-[12.5px]">
            {allDone
              ? "Loja pronta — comece a divulgar pelo WhatsApp e Instagram."
              : "5 passos rápidos pra colocar sua vitrine no ar."}
          </p>
        </div>
        <span className="text-ink-4 mono text-[11px] font-semibold tracking-[0.04em]">
          {doneCount}/{total} concluídos
        </span>
      </div>

      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.number}
            className="border-line bg-bg-app flex items-start gap-3 rounded-[10px] border p-3 sm:items-center"
          >
            {step.done ? (
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--ok-wash)", color: "var(--ok)" }}
                aria-label="Concluído"
              >
                <CheckIcon className="size-4" aria-hidden />
              </div>
            ) : (
              <div
                className="mono grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11.5px] font-bold"
                style={{
                  background: "var(--brand-wash)",
                  color: "var(--brand)",
                }}
                aria-hidden
              >
                {step.number}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p
                className={
                  step.done
                    ? "text-ink-3 text-[13px] font-semibold leading-tight line-through"
                    : "text-ink-1 text-[13px] font-semibold leading-tight"
                }
              >
                {step.title}
              </p>
              <p className="text-ink-4 mt-0.5 text-[12px] leading-snug">
                {step.description}
              </p>
            </div>

            <Link
              href={step.href}
              prefetch
              className="b3-btn b3-btn--sm inline-flex shrink-0 items-center gap-1"
              aria-label={`${step.ctaLabel} — passo ${step.number}: ${step.title}`}
            >
              {step.done ? "Revisar" : step.ctaLabel}
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Faixa fina pra dashboard maduro com passos pendentes — mostra
 * "3/5 passos · Próximo: Subir logo →". Quando todos os steps foram
 * concluídos, o caller esconde o componente (não renderiza nada).
 */
export interface OnboardingProgressStripProps {
  steps: ChecklistStep[];
}

export function OnboardingProgressStrip({
  steps,
}: OnboardingProgressStripProps) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (doneCount >= total) return null;
  const nextStep = steps.find((s) => !s.done);
  if (!nextStep) return null;

  return (
    <Link
      href={nextStep.href}
      prefetch
      className="border-line bg-bg-app hover:bg-mangos-cream-soft flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-2.5 text-[12.5px] transition-colors"
      aria-label={`${doneCount} de ${total} passos · Próximo: ${nextStep.title}`}
    >
      <span
        className="mono inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
        style={{
          background: "var(--brand-wash)",
          color: "var(--brand)",
        }}
      >
        {doneCount}/{total}
      </span>
      <span className="text-ink-3 hidden sm:inline">
        Configuração da loja —
      </span>
      <span className="text-ink-2 min-w-0 flex-1 font-medium">
        Próximo: <strong className="text-ink-1">{nextStep.title}</strong>
      </span>
      <span className="text-mangos-green-800 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold">
        {nextStep.ctaLabel}
        <ArrowRightIcon className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
