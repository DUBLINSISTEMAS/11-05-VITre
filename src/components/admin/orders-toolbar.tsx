"use client";

// Toolbar da lista de pedidos.
//
// URL-driven (server reflete a verdade no listing/agregados):
//   - q:     busca por shortCode (uppercase) OU substring do nome
//   - canal: enum whatsapp|balcao
//   - de / ate: range de data ISO YYYY-MM-DD (Onda 1.4)
//
// Onda 1.4 (2026-05-22):
//   - botão "Hoje" deixou de ser toast — toggla filtro do dia atual
//   - atalhos rápidos "Ontem", "7 dias", "Mês" pra fechar o "50× por dia"
//   - rodapé direito mostra agregados do PERÍODO filtrado:
//       N vendas · R$ TOTAL · ticket R$ MÉDIO
//       split por método em pílulas abaixo (cash/pix/débito/crédito/outro)
import { CalendarIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { formatBRL } from "@/lib/pricing";

export interface OrdersPeriodSummary {
  /** Soma de `order.total_in_cents` das vendas não-canceladas do período. */
  totalInCents: number;
  /** Quantas vendas não-canceladas (status NOT IN canceled/expired). */
  count: number;
  /** totalInCents / count (arredondado). 0 quando count=0. */
  ticketAverageInCents: number;
  /** Soma de `order_payment.amount_in_cents` por método. */
  byMethod: Record<string, number>;
}

interface OrdersToolbarProps {
  /** Range visual "X – Y de Z" pro counter da direita. */
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Agregados do período filtrado (Onda 1.4). */
  periodSummary: OrdersPeriodSummary;
  /** Filtro de data ativo (YYYY-MM-DD). null = sem filtro. */
  dateFromIso: string | null;
  dateToIso: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

/** YYYY-MM-DD em local time. Reflexo do toIsoDate do server. */
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

/** DD/MM curto pro chip de data ativa. */
function formatBR(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

export function OrdersToolbar({
  rangeStart,
  rangeEnd,
  total,
  periodSummary,
  dateFromIso,
  dateToIso,
}: OrdersToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const canal = searchParams.get("canal") ?? "";
  // Sprint 3.4 — toggle "só fiado pendente". 'pendente' | ''.
  const fiado = searchParams.get("fiado") ?? "";

  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(window.location.search);
      const current = usp.get("q") ?? "";
      if (q === current) return;
      const trimmed = q.trim();
      if (trimmed) usp.set("q", trimmed.toUpperCase());
      else usp.delete("q");
      usp.delete("page");
      startTransition(() => {
        router.replace(`?${usp.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [q, router]);

  const updateCanal = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (!value) usp.delete("canal");
    else usp.set("canal", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  // Sprint 3.4 — toggle pendente↔off. Clica de novo quando ativo limpa.
  const toggleFiadoPendente = () => {
    const usp = new URLSearchParams(window.location.search);
    if (fiado === "pendente") usp.delete("fiado");
    else usp.set("fiado", "pendente");
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

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

  // Estado dos atalhos — derivado da URL pra não dessincronizar com server.
  const today = todayIso();
  const yesterday = isoMinusDays(1);
  const sevenDaysAgo = isoMinusDays(6); // janela inclusiva de 7 dias
  const monthStart = startOfMonthIso();

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

  // Ordem fixa pras pílulas do split — segue ordem mental do lojista
  // (cash primeiro). Esconde método se zero.
  const methodOrder = ["cash", "pix", "debit", "credit", "other"];
  const splitEntries = methodOrder
    .map((m) => [m, periodSummary.byMethod[m] ?? 0] as const)
    .filter(([, v]) => v > 0);

  return (
    <div className="b3-toolbar flex-wrap gap-y-2">
      {/* Audit 2026-05-26 — checkbox "Selecionar todos" placeholder REMOVIDO.
          Quebrava a régua "funciona ou esconde": ficava cinza com tooltip
          "em breve" mas não tinha bulk actions atrás. Volta quando ações
          em lote (cancelar/imprimir múltiplo) forem implementadas. */}
      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Procurar por código ou cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar vendas"
        />
      </div>

      {/* Atalhos de data — Onda 1.4. Cada botão é toggle: clicar de novo
          quando já ativo limpa o filtro. */}
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

      {/* Range custom + outros filtros (defer pra evolução) */}
      <details className="relative">
        <summary
          className="b3-btn b3-btn--sm list-none"
          style={{ cursor: "pointer" }}
          aria-label="Filtros avançados"
        >
          <FilterIcon size={13} /> Filtros
        </summary>
        <div className="absolute right-0 top-9 z-10 w-72 rounded-lg border border-line bg-bg-card p-3 shadow-lg">
          <p className="text-eyebrow mb-2">Período personalizado</p>
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            <label className="flex flex-col gap-1">
              <span className="text-ink-4">De</span>
              <input
                type="date"
                className="b3-input h-8 px-2"
                value={dateFromIso ?? ""}
                max={dateToIso ?? today}
                onChange={(e) =>
                  applyDateRange(e.target.value || null, dateToIso)
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-4">Até</span>
              <input
                type="date"
                className="b3-input h-8 px-2"
                value={dateToIso ?? ""}
                min={dateFromIso ?? undefined}
                max={today}
                onChange={(e) =>
                  applyDateRange(dateFromIso, e.target.value || null)
                }
              />
            </label>
          </div>
        </div>
      </details>

      <select
        className="b3-select"
        style={{ width: 150, height: 32, fontSize: 12.5 }}
        value={canal}
        onChange={(e) => updateCanal(e.target.value)}
        aria-label="Filtrar por canal"
      >
        <option value="">Todos os canais</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="balcao">Balcão (PDV)</option>
      </select>

      {/* Sprint 3.4 — toggle só vendas com fiado pendente. Mostra
          counter via re-render do server (total da listagem reflete). */}
      <button
        type="button"
        className={`b3-btn b3-btn--sm ${fiado === "pendente" ? "b3-pill--brand" : ""}`}
        onClick={toggleFiadoPendente}
        aria-pressed={fiado === "pendente"}
        title="Mostrar apenas vendas com saldo de fiado em aberto"
      >
        Só fiado pendente
      </button>

      {/* Chip de filtro de data custom — só mostra quando preset não bate */}
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

      <div style={{ flex: 1 }} />

      {/* Agregados do período — Onda 1.4. Quando não há filtro, mostra
          totais do tenant inteiro (= mesma soma do listing). */}
      <div className="ml-auto flex flex-col items-end gap-0.5 text-right">
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--ink-1)", fontWeight: 600 }}
          aria-live="polite"
        >
          {periodSummary.count === 0
            ? total === 0
              ? "0 vendas"
              : `${rangeStart} – ${rangeEnd} de ${total}`
            : `${periodSummary.count} ${periodSummary.count === 1 ? "venda" : "vendas"} · ${formatBRL(periodSummary.totalInCents)}`}
        </span>
        {periodSummary.count > 0 ? (
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-4)" }}
          >
            Ticket médio {formatBRL(periodSummary.ticketAverageInCents)}
          </span>
        ) : null}
        {splitEntries.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
            {splitEntries.map(([method, value]) => (
              <span
                key={method}
                className="b3-pill"
                style={{ fontSize: 10.5 }}
                title={METHOD_LABEL[method] ?? method}
              >
                {METHOD_LABEL[method] ?? method} {formatBRL(value)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
