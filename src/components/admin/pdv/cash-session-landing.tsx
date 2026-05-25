"use client";

/**
 * Landing de caixa formal (ADR-0022). Mostra:
 *   1. Sessão ativa (se houver) — card com expected + botões sangria/
 *      reforço/fechar.
 *   2. Botão "Abrir caixa" se não há sessão ativa.
 *   3. Histórico das últimas N sessões (link pra /admin/pdv/caixa/[id]).
 */

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalculatorIcon,
  HistoryIcon,
  LockIcon,
  LockOpenIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatBRL } from "@/lib/pricing";

import { AdjustmentDialog } from "./adjustment-dialog";
import { CloseCashDialog } from "./close-cash-dialog";
import { OpenCashDialog } from "./open-cash-dialog";

interface ActiveSessionData {
  id: string;
  openedAt: Date;
  openingAmountInCents: number;
  cashSalesInCents: number;
  sangriaInCents: number;
  reinforcementInCents: number;
  expectedInCents: number;
  saleCount: number;
}

interface HistorySessionData {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  openingAmountInCents: number;
  closingActualInCents: number | null;
}

interface CashSessionLandingProps {
  active: ActiveSessionData | null;
  history: HistorySessionData[];
}

export function CashSessionLanding({ active, history }: CashSessionLandingProps) {
  const [openDialog, setOpenDialog] = useState<
    "open" | "sangria" | "reinforcement" | "close" | null
  >(null);

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-ink-1 text-[16px] font-semibold tracking-[-0.015em]">
              Caixa formal
            </h2>
            <p className="text-ink-4 text-[12px]">
              Abertura, sangria, reforço e fechamento Z.
            </p>
          </div>
          {!active ? (
            <button
              type="button"
              onClick={() => setOpenDialog("open")}
              className="b3-btn b3-btn--cta"
            >
              <PlusIcon size={14} aria-hidden /> Abrir caixa
            </button>
          ) : null}
        </div>

        {active ? (
          <ActiveSessionCard
            active={active}
            onSangria={() => setOpenDialog("sangria")}
            onReinforcement={() => setOpenDialog("reinforcement")}
            onClose={() => setOpenDialog("close")}
          />
        ) : (
          <EmptyStateClosed />
        )}

        {history.length > 0 ? (
          <HistoryList history={history} activeId={active?.id ?? null} />
        ) : null}
      </section>

      <OpenCashDialog
        open={openDialog === "open"}
        onOpenChange={(o) => setOpenDialog(o ? "open" : null)}
      />
      {active ? (
        <>
          <AdjustmentDialog
            open={openDialog === "sangria"}
            sessionId={active.id}
            type="sangria"
            onOpenChange={(o) => setOpenDialog(o ? "sangria" : null)}
          />
          <AdjustmentDialog
            open={openDialog === "reinforcement"}
            sessionId={active.id}
            type="reinforcement"
            onOpenChange={(o) => setOpenDialog(o ? "reinforcement" : null)}
          />
          <CloseCashDialog
            open={openDialog === "close"}
            sessionId={active.id}
            expectedInCents={active.expectedInCents}
            onOpenChange={(o) => setOpenDialog(o ? "close" : null)}
          />
        </>
      ) : null}
    </>
  );
}

function EmptyStateClosed() {
  return (
    <div className="border-line bg-bg-app flex items-center gap-3 rounded-[12px] border border-dashed p-4">
      <div className="text-ink-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
        <LockOpenIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-1 text-[13.5px] font-semibold">
          Nenhum caixa aberto agora
        </p>
        <p className="text-ink-4 text-[12px] leading-relaxed">
          Abra um caixa pra registrar troco inicial, sangria e fechamento
          Z imprimível. Vendas balcão sem caixa formal continuam saindo
          normalmente — sem vínculo de auditoria, só com snapshot básico.
        </p>
      </div>
    </div>
  );
}

function ActiveSessionCard({
  active,
  onSangria,
  onReinforcement,
  onClose,
}: {
  active: ActiveSessionData;
  onSangria: () => void;
  onReinforcement: () => void;
  onClose: () => void;
}) {
  const openedAtMs = new Date(active.openedAt).getTime();
  const durationMin = Math.floor((Date.now() - openedAtMs) / 60_000);
  const durationLabel =
    durationMin < 60
      ? `${durationMin} min`
      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  return (
    <div className="b3-card overflow-hidden">
      <header className="border-line flex flex-wrap items-center gap-3 border-b p-4">
        <div className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalculatorIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ink-1 text-[14px] font-semibold">
            Caixa aberto há {durationLabel}
          </p>
          <p className="text-ink-4 text-[12px]">
            {active.saleCount}{" "}
            {active.saleCount === 1 ? "venda balcão" : "vendas balcão"} nessa
            sessão
          </p>
        </div>
        <Link
          href={`/admin/pdv/caixa/${active.id}`}
          prefetch
          className="b3-btn b3-btn--sm"
        >
          Ver Z parcial
        </Link>
      </header>

      {/* Grid de KPIs — 5 cards no desktop (Abertura · Vendas em dinheiro
          · Sangria · Reforço · Esperado em caixa). O último ganha
          destaque visual cream-soft (handoff Passo 7) pq é o número
          chave pro lojista bater na hora do fechamento Z. */}
      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Abertura" value={active.openingAmountInCents} accent="ink" />
        <Kpi
          label="Vendas em dinheiro"
          value={active.cashSalesInCents}
          accent="ok"
        />
        <Kpi
          label="Sangria"
          value={active.sangriaInCents}
          accent="danger"
          prefix="−"
        />
        <Kpi
          label="Reforço"
          value={active.reinforcementInCents}
          accent="warn"
          prefix="+"
        />
        <Kpi
          label="Esperado em caixa"
          value={active.expectedInCents}
          accent="brand"
        />
      </dl>

      <div className="bg-surface flex flex-wrap gap-2 p-4">
        <button
          type="button"
          onClick={onSangria}
          className="b3-btn b3-btn--sm"
          aria-label="Registrar sangria"
        >
          <ArrowDownIcon size={13} aria-hidden /> Sangria
        </button>
        <button
          type="button"
          onClick={onReinforcement}
          className="b3-btn b3-btn--sm"
          aria-label="Registrar reforço de troco"
        >
          <ArrowUpIcon size={13} aria-hidden /> Reforço
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="b3-btn b3-btn--cta b3-btn--sm"
        >
          <LockIcon size={13} aria-hidden /> Fechar caixa
        </button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  prefix,
}: {
  label: string;
  value: number;
  accent: "ink" | "ok" | "danger" | "warn" | "brand";
  prefix?: string;
}) {
  const colorClass =
    accent === "ok"
      ? "text-ok"
      : accent === "danger"
        ? "text-danger"
        : accent === "warn"
          ? "text-warn"
          : accent === "brand"
            ? "text-mangos-green-900"
            : "text-ink-1";
  // accent="brand" = destaque cream-soft (KPI principal "Esperado em caixa").
  const tileClass =
    accent === "brand"
      ? "space-y-1 p-3 bg-mangos-cream-soft border-l border-brand-line"
      : "bg-surface space-y-1 p-3";
  const labelClass =
    accent === "brand"
      ? "text-mangos-green-700 text-[10.5px] font-bold uppercase tracking-[0.06em]"
      : "text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]";
  const valueSize = accent === "brand" ? "text-[18px]" : "text-[16px]";
  return (
    <div className={tileClass}>
      <dt className={labelClass}>{label}</dt>
      <dd className={`mono ${valueSize} font-semibold ${colorClass}`}>
        {prefix && value > 0 ? prefix : ""}
        {formatBRL(value)}
      </dd>
    </div>
  );
}

function HistoryList({
  history,
  activeId,
}: {
  history: HistorySessionData[];
  activeId: string | null;
}) {
  return (
    <div className="b3-card overflow-hidden">
      <div className="b3-card-hd flex items-center gap-2">
        <HistoryIcon size={14} aria-hidden />
        <h3>Histórico de caixas</h3>
      </div>
      <ul className="divide-line divide-y">
        {history.map((s) => {
          const isActive = s.id === activeId;
          return (
            <li key={s.id}>
              <Link
                href={`/admin/pdv/caixa/${s.id}`}
                prefetch={false}
                className="hocus:bg-bg-app flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    isActive
                      ? "bg-brand/10 text-brand"
                      : s.closedAt
                        ? "bg-bg-app text-ink-4"
                        : "bg-warn/10 text-warn"
                  }`}
                >
                  {s.closedAt ? (
                    <LockIcon className="size-3.5" />
                  ) : (
                    <LockOpenIcon className="size-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-1 text-[13px] font-medium">
                    {formatDateTime(s.openedAt)}
                    {isActive ? (
                      <span className="bg-brand-wash text-brand ml-2 rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide">
                        Ativa
                      </span>
                    ) : null}
                  </p>
                  <p className="text-ink-4 text-[11.5px]">
                    Abertura {formatBRL(s.openingAmountInCents)} ·{" "}
                    {s.closedAt
                      ? `fechado ${formatDateTime(s.closedAt)}`
                      : "aberto"}
                  </p>
                </div>
                {s.closingActualInCents !== null ? (
                  <span className="mono text-ink-1 text-[12.5px] font-medium tabular-nums">
                    {formatBRL(s.closingActualInCents)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatDateTime(d: Date): string {
  const date = new Date(d);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
