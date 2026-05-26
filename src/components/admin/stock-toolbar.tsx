"use client";

// Toolbar Dublin v3 da lista de movimentações de estoque (port Dublin v3,
// ADR-0019, Onda A.10). Substitui StockMovementsFilters antigo.
//
// Layout `b3-toolbar`:
//   checkbox master (disabled)
//   `b3-toolbar-search` busca debounced 300ms
//   Select Tipo de movimentação (shadcn — substitui o select solto da
//     filters antiga; mantém valor crítico inline em vez de placeholder)
//   button "Ordenar" placeholder (ordem fixa createdAt desc por enquanto)
//   button "Filtros" placeholder (toast)
//   flex spacer
//   counter mono "X – Y de Z"

import { CalendarIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** YYYY-MM-DD em local time. */
function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function todayIso(): string {
  return toIso(new Date());
}
function isoMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIso(d);
}
function startOfMonthIso(): string {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
}
function formatBR(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

const TYPE_ALL = "__all__";

const TYPE_OPTIONS = [
  { value: TYPE_ALL, label: "Todos os tipos" },
  { value: "initial", label: "Saldo inicial" },
  { value: "manual_in", label: "Entrada manual" },
  { value: "manual_out", label: "Saída manual" },
  { value: "sale", label: "Venda" },
  { value: "return", label: "Devolução" },
  { value: "adjustment", label: "Ajuste" },
];

interface StockToolbarProps {
  /** "X – Y de Z" já calculada server-side. */
  rangeLabel: string;
  /** Filtros de data ativos (YYYY-MM-DD) — passados do server pra refletir estado. */
  dateFromIso: string | null;
  dateToIso: string | null;
}

export function StockToolbar({
  rangeLabel,
  dateFromIso,
  dateToIso,
}: StockToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? TYPE_ALL;

  const [q, setQ] = useState(initialQ);

  const today = todayIso();
  const yesterday = isoMinusDays(1);
  const sevenDaysAgo = isoMinusDays(6);
  const monthStart = startOfMonthIso();

  // Detecta preset ativo baseado nos params atuais (mesma lógica do
  // orders-toolbar).
  const activePreset: "today" | "yesterday" | "7d" | "month" | null = (() => {
    if (!dateFromIso || !dateToIso) return null;
    if (dateFromIso === today && dateToIso === today) return "today";
    if (dateFromIso === yesterday && dateToIso === yesterday)
      return "yesterday";
    if (dateFromIso === sevenDaysAgo && dateToIso === today) return "7d";
    if (dateFromIso === monthStart && dateToIso === today) return "month";
    return null;
  })();

  const hasDateFilter = dateFromIso !== null || dateToIso !== null;
  const dateChipLabel = hasDateFilter
    ? dateFromIso === dateToIso && dateFromIso
      ? formatBR(dateFromIso)
      : `${dateFromIso ? formatBR(dateFromIso) : "…"} – ${
          dateToIso ? formatBR(dateToIso) : "…"
        }`
    : null;

  const applyDateRange = (de: string | null, ate: string | null) => {
    const usp = new URLSearchParams(window.location.search);
    if (de) usp.set("de", de);
    else usp.delete("de");
    if (ate) usp.set("ate", ate);
    else usp.delete("ate");
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(window.location.search);
      const current = usp.get("q") ?? "";
      if (q === current) return;
      const trimmed = q.trim();
      if (trimmed) usp.set("q", trimmed);
      else usp.delete("q");
      usp.delete("page");
      startTransition(() => {
        router.replace(`?${usp.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [q, router]);

  const updateType = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === TYPE_ALL) usp.delete("type");
    else usp.set("type", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="b3-toolbar">
      {/* Audit 2026-05-26 — checkbox "Selecionar todos" placeholder
          removido (mesma régua aplicada em orders-toolbar). Bulk actions
          em estoque ainda não tem caso de uso definido. */}

      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Procurar por nome do produto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar movimentações de estoque"
        />
      </div>

      <Select value={type} onValueChange={updateType}>
        <SelectTrigger
          className="h-9 min-w-40 max-w-52"
          data-active={type !== TYPE_ALL ? "true" : undefined}
        >
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Audit 2026-05-26 — presets de data (Hoje / Ontem / 7d / Mês). Mesmo
          padrão do orders-toolbar. Toggle: clicar de novo no ativo limpa. */}
      <button
        type="button"
        className={`b3-btn b3-btn--sm ${activePreset === "today" ? "b3-pill--brand" : ""}`}
        onClick={() =>
          applyDateRange(
            activePreset === "today" ? null : today,
            activePreset === "today" ? null : today,
          )
        }
        aria-pressed={activePreset === "today"}
      >
        <CalendarIcon size={13} /> Hoje
      </button>
      <button
        type="button"
        className={`b3-btn b3-btn--sm ${activePreset === "yesterday" ? "b3-pill--brand" : ""}`}
        onClick={() =>
          applyDateRange(
            activePreset === "yesterday" ? null : yesterday,
            activePreset === "yesterday" ? null : yesterday,
          )
        }
        aria-pressed={activePreset === "yesterday"}
      >
        Ontem
      </button>
      <button
        type="button"
        className={`b3-btn b3-btn--sm ${activePreset === "7d" ? "b3-pill--brand" : ""}`}
        onClick={() =>
          applyDateRange(
            activePreset === "7d" ? null : sevenDaysAgo,
            activePreset === "7d" ? null : today,
          )
        }
        aria-pressed={activePreset === "7d"}
      >
        7 dias
      </button>
      <button
        type="button"
        className={`b3-btn b3-btn--sm ${activePreset === "month" ? "b3-pill--brand" : ""}`}
        onClick={() =>
          applyDateRange(
            activePreset === "month" ? null : monthStart,
            activePreset === "month" ? null : today,
          )
        }
        aria-pressed={activePreset === "month"}
      >
        Mês
      </button>

      {/* Chip de filtro custom — só mostra quando não bate em nenhum preset */}
      {hasDateFilter && activePreset === null ? (
        <button
          type="button"
          className="b3-pill b3-pill--brand flex items-center gap-1"
          onClick={() => applyDateRange(null, null)}
          aria-label="Limpar filtro de data"
          title="Limpar filtro de data"
        >
          {dateChipLabel}
          <XIcon size={11} />
        </button>
      ) : null}

      <div className="flex-1" />

      <span className="mono text-[12px] text-ink-4">{rangeLabel}</span>
    </div>
  );
}
