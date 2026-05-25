// Page stub honesta pra relatórios PP10 ainda não implementados (handoff
// pixel-perfect 2026-05-25). Mostra título, descrição do que vai medir,
// e nota explícita "em construção" com link de volta pra /admin/relatorios.
//
// Decisão: cards já no index pra bater 1:1 o handoff (8 cards), mas
// implementação real fica como PP10.x quando demanda apertar. Régua
// "funciona-ou-esconde" temporariamente suspensa durante a onda PP
// (memory: pixel-perfect-redesign-decisao-2026-05-25).

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

interface ReportStubPageProps {
  title: string;
  description: string;
  willMeasure: string[];
}

export function ReportStubPage({
  title,
  description,
  willMeasure,
}: ReportStubPageProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/admin/relatorios"
          aria-label="Voltar para relatórios"
          className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
          prefetch
        >
          <ChevronLeftIcon size={15} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
              {title}
            </h1>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: "var(--mangos-yellow-soft)",
                color: "var(--mangos-yellow-deep)",
              }}
            >
              Em construção
            </span>
          </div>
          <p className="text-ink-4 mt-1 text-[13px]">{description}</p>
        </div>
      </div>

      <div
        className="rounded-[14px] p-6"
        style={{
          background: "var(--mangos-cream-soft)",
          border: "1px solid var(--brand-line)",
        }}
      >
        <p className="text-ink-2 text-[13.5px] font-semibold">
          O que esse relatório vai medir
        </p>
        <ul className="text-ink-3 mt-3 space-y-1.5 text-[13px]">
          {willMeasure.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span
                aria-hidden
                className="text-mangos-yellow-deep mt-1 text-[12px]"
              >
                ●
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-ink-4 mt-4 text-[12px] leading-relaxed">
          Decisão pixel-perfect 1:1 do handoff (2026-05-25): o card já
          aparece na galeria pra refletir o protótipo completo. A
          implementação real entra em PP10.x quando demanda apertar — o
          schema necessário já existe no DB, então é só montar loader +
          ReportLayout.
        </p>
      </div>
    </div>
  );
}
