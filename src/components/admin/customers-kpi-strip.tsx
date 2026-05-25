// KPI strip de /admin/clientes — handoff Passo 11.
//
// 4 cards horizontais com auto-fit grid. Server component — recebe os
// números já calculados pelo page.tsx (não busca nada por si).
// Empty state honesto pra cada card quando o dado não faz sentido
// (ex: ticket médio sem venda).

import { formatBRL } from "@/lib/pricing";

export interface CustomersKpis {
  totalCustomers: number;
  creditOutstandingInCents: number;
  customersWithDebt: number;
  /** Ticket médio em centavos (venda não-cancelada do mês). null = sem venda. */
  ticketAverageInCents: number | null;
  /** Clientes criados nos últimos 30 dias. */
  newThisMonth: number;
}

export function CustomersKpiStrip({ kpis }: { kpis: CustomersKpis }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      <Card label="Total de clientes">
        <span className="font-mono text-[22px] font-bold tabular-nums text-ink-1">
          {kpis.totalCustomers}
        </span>
      </Card>

      <Card label="Fiado em aberto">
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
        </span>
      </Card>

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
