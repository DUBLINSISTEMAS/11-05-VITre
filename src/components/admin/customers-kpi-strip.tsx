// KPI strip de /admin/clientes — handoff Passo 11.
//
// 4 cards horizontais com auto-fit grid. Server component — recebe os
// números já calculados pelo page.tsx (não busca nada por si).
// Empty state honesto pra cada card quando o dado não faz sentido
// (ex: ticket médio sem venda).
//
// Bloco I.4 (2026-05-29) — "Fiado em aberto" virou KPI clicável:
// quando há saldo devedor, o card é um <Link> pra `?fiado=open` (filtra
// lista pra devedores); quando filtro está ativo, fica destacado e
// vira link de remoção pra `?fiado=` (clear). Demais cards continuam
// estáticos enquanto não houver filtro derivado.

import Link from "next/link";

import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface CustomersKpis {
  totalCustomers: number;
  creditOutstandingInCents: number;
  customersWithDebt: number;
  /** Ticket médio em centavos (venda não-cancelada do mês). null = sem venda. */
  ticketAverageInCents: number | null;
  /** Clientes criados nos últimos 30 dias. */
  newThisMonth: number;
}

interface CustomersKpiStripProps {
  kpis: CustomersKpis;
  /** Quando `?fiado=open` está ativo, destaca o card e converte em link de clear. */
  fiadoActive?: boolean;
}

export function CustomersKpiStrip({
  kpis,
  fiadoActive = false,
}: CustomersKpiStripProps) {
  const fiadoClickable = kpis.creditOutstandingInCents > 0 || fiadoActive;
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      <Card label="Total de clientes">
        <span className="font-mono text-[22px] font-bold tabular-nums text-ink-1">
          {kpis.totalCustomers}
        </span>
      </Card>

      <ClickableCard
        label="Fiado em aberto"
        href={fiadoActive ? "?fiado=" : "?fiado=open"}
        clickable={fiadoClickable}
        active={fiadoActive}
        title={
          fiadoActive
            ? "Remover filtro de fiado"
            : kpis.creditOutstandingInCents > 0
              ? "Filtrar lista pra ver só quem deve"
              : undefined
        }
      >
        <span
          className="font-mono text-[22px] font-bold tabular-nums"
          style={{
            color:
              kpis.creditOutstandingInCents > 0
                ? "var(--mangos-yellow-deep)"
                : "var(--ink-3)",
          }}
        >
          {formatBRL(kpis.creditOutstandingInCents)}
        </span>
        <span className="text-ink-4 mt-0.5 block text-[11.5px]">
          {kpis.customersWithDebt}{" "}
          {kpis.customersWithDebt === 1 ? "cliente" : "clientes"}
          {fiadoActive ? " · filtro ativo (clique pra limpar)" : ""}
        </span>
      </ClickableCard>

      <Card label="Ticket médio (mês)">
        {kpis.ticketAverageInCents === null ? (
          <span className="text-ink-4 text-[13px] italic">Sem vendas no mês</span>
        ) : (
          <span className="font-mono text-[22px] font-bold tabular-nums text-ink-1">
            {formatBRL(kpis.ticketAverageInCents)}
          </span>
        )}
      </Card>

      <Card label="Novos (30 dias)">
        <span className="font-mono text-[22px] font-bold tabular-nums text-ink-1">
          {kpis.newThisMonth}
        </span>
      </Card>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="b3-card b3-card-pad">
      <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ClickableCard({
  label,
  href,
  clickable,
  active,
  title,
  children,
}: {
  label: string;
  href: string;
  clickable: boolean;
  active: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </>
  );
  if (!clickable) {
    return <div className="b3-card b3-card-pad">{inner}</div>;
  }
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "b3-card b3-card-pad cursor-pointer outline-none transition",
        "hover:border-brand/40 focus-visible:ring-brand/50 focus-visible:ring-2",
        active && "border-brand/60 ring-brand/40 ring-2",
      )}
    >
      {inner}
    </Link>
  );
}
