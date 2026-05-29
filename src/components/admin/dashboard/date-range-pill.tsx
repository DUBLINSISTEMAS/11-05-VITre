"use client";

// DateRangePill — pílula com calendário + intervalo + chevron.
//
// Cosmética: encapsula o controle real `?periodo=7|30|90` no URL. Mostra
// o intervalo formatado em PT-BR (ex: "1 abr – 1 mai 2026") e abre um
// DropdownMenu com 3 presets. Não introduz date picker custom — manter
// consistência com a query existente e com a SalesSummaryCard removida.

import { CalendarIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Periodo = 7 | 30 | 90;

const PRESETS: Array<{ value: Periodo; label: string }> = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
];

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatRange(periodo: Periodo): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (periodo - 1));

  const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()]!.slice(0, 3)}`;
  const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()]!.slice(0, 3)}, ${end.getFullYear()}`;
  return `${startStr} – ${endStr}`;
}

export interface DateRangePillProps {
  periodo: Periodo;
}

export function DateRangePill({ periodo }: DateRangePillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (next: Periodo) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 30) {
      params.delete("periodo");
    } else {
      params.set("periodo", String(next));
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin?${qs}` : "/admin");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "b3-daterange-pill",
          isPending && "opacity-70",
        )}
        aria-label="Selecionar período"
        disabled={isPending}
      >
        <CalendarIcon size={14} aria-hidden />
        <span className="b3-daterange-pill-text">{formatRange(periodo)}</span>
        <ChevronDownIcon size={13} aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-48">
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.value}
            onSelect={() => handleSelect(p.value)}
            className="gap-2"
          >
            <CheckIcon
              size={14}
              className={cn(
                "shrink-0",
                p.value === periodo ? "opacity-100" : "opacity-0",
              )}
            />
            <span>{p.label}</span>
          </DropdownMenuItem>
        ))}
        {/* Bloco E3 UX (2026-05-29): explicita o escopo do controle.
            Antes lojista trocava pra 90 dias e estranhava o Hero não
            mudar (Hero usa janela fixa ontem + semana). */}
        <p className="text-ink-4 mt-1 border-t border-line/60 px-2 py-1.5 text-[10.5px] leading-snug">
          Afeta os KPIs e o gráfico de receita. Lucro de ontem e da
          semana usa janela fixa.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
