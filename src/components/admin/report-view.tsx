"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FullReport } from "@/actions/reports/load";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  other: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Novos",
  contacted: "Contatados",
  converted: "Convertidos",
  lost: "Perdidos",
};

export function ReportView({
  report,
  filters,
}: {
  report: FullReport;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const currentPeriodo = filters.periodo ?? "30";
  const [customStart, setCustomStart] = useState(filters.start ?? "");
  const [customEnd, setCustomEnd] = useState(filters.end ?? "");

  function changePeriod(periodo: string) {
    const params = new URLSearchParams();
    params.set("periodo", periodo);
    router.replace(`/admin/relatorios?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) return;
    const params = new URLSearchParams();
    params.set("periodo", "custom");
    params.set("start", customStart);
    params.set("end", customEnd);
    router.replace(`/admin/relatorios?${params.toString()}`);
  }

  function downloadCsv() {
    const lines: string[] = [];
    const add = (s: string) => lines.push(s);
    const csvEscape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes("\"") || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    add(`Relatório Vitrê - ${report.range.periodLabel}`);
    add("");
    add("VENDAS");
    add(`Total de vendas,${report.sales.totalSales}`);
    add(`Receita total,${(report.sales.totalRevenueInCents / 100).toFixed(2)}`);
    add(`Ticket médio,${(report.sales.averageTicketInCents / 100).toFixed(2)}`);
    add("");
    add("VENDAS POR CANAL");
    add("Canal,Quantidade,Receita");
    for (const c of report.sales.byChannel) {
      add(`${c.channel},${c.count},${(c.revenueInCents / 100).toFixed(2)}`);
    }
    add("");
    add("VENDAS POR PAGAMENTO");
    add("Método,Quantidade,Receita");
    for (const p of report.sales.byPaymentMethod) {
      add(
        `${csvEscape(p.method ?? "—")},${p.count},${(p.revenueInCents / 100).toFixed(2)}`,
      );
    }
    add("");
    add("TOP PRODUTOS POR RECEITA");
    add("Produto,Quantidade,Receita");
    for (const p of report.products.topByRevenue) {
      add(
        `${csvEscape(p.name)},${p.quantity},${(p.revenueInCents / 100).toFixed(2)}`,
      );
    }
    add("");
    add("TOP CLIENTES");
    add("Cliente,Pedidos,Total gasto");
    for (const c of report.customers.topCustomers) {
      add(
        `${csvEscape(c.name)},${c.orderCount},${(c.totalSpentInCents / 100).toFixed(2)}`,
      );
    }
    add("");
    add("LEADS");
    add(`Total,${report.leads.totalLeads}`);
    add(`Taxa de conversão,${(report.leads.conversionRate * 100).toFixed(1)}%`);
    for (const l of report.leads.byStatus) {
      add(`${STATUS_LABEL[l.status] ?? l.status},${l.count}`);
    }
    add("");
    add("ESTOQUE ZERADO");
    for (const s of report.stock.zeroStock) {
      add(csvEscape(s.name));
    }
    add("");
    add("ESTOQUE BAIXO (≤ 3)");
    add("Produto,Quantidade");
    for (const s of report.stock.lowStock) {
      add(`${csvEscape(s.name)},${s.quantity}`);
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `vitre-relatorio-${datePart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Relatórios
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            Visão consolidada · {report.range.periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="b3-input"
            value={currentPeriodo}
            onChange={(e) => changePeriod(e.target.value)}
            aria-label="Período do relatório"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Período personalizado…</option>
          </select>
          {currentPeriodo === "custom" && (
            <>
              <input
                type="date"
                className="b3-input"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Data inicial"
              />
              <span className="text-ink-4 text-[12px]">até</span>
              <input
                type="date"
                className="b3-input"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="Data final"
              />
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={
                  !customStart || !customEnd || customStart > customEnd
                }
                className="b3-btn"
              >
                Aplicar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={downloadCsv}
            className="b3-btn"
          >
            <DownloadIcon size={13} /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="b3-btn b3-btn--cta"
          >
            <PrinterIcon size={13} /> Imprimir
          </button>
        </div>
      </div>

      {/* Vendas — destaque */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Vendas no período"
          value={report.sales.totalSales.toString()}
        />
        <KpiCard
          label="Receita"
          value={formatBRL(report.sales.totalRevenueInCents)}
          tone="brand"
        />
        <KpiCard
          label="Ticket médio"
          value={formatBRL(report.sales.averageTicketInCents)}
        />
      </section>

      {/* By channel + payment */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ReportCard title="Vendas por canal">
          {report.sales.byChannel.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Canal", "Qtd", "Receita"]}
              rows={report.sales.byChannel.map((b) => [
                b.channel === "whatsapp" ? "WhatsApp" : "Balcão",
                b.count.toString(),
                formatBRL(b.revenueInCents),
              ])}
            />
          )}
        </ReportCard>
        <ReportCard title="Vendas por pagamento">
          {report.sales.byPaymentMethod.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Método", "Qtd", "Receita"]}
              rows={report.sales.byPaymentMethod.map((b) => [
                PAYMENT_LABEL[b.method ?? ""] ?? b.method ?? "—",
                b.count.toString(),
                formatBRL(b.revenueInCents),
              ])}
            />
          )}
        </ReportCard>
      </section>

      {/* Top produtos */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ReportCard title="Top produtos por receita">
          {report.products.topByRevenue.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Produto", "Qtd", "Receita"]}
              rows={report.products.topByRevenue
                .slice(0, 8)
                .map((p) => [p.name, p.quantity.toString(), formatBRL(p.revenueInCents)])}
            />
          )}
        </ReportCard>
        <ReportCard title="Top produtos por quantidade">
          {report.products.topByQuantity.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Produto", "Qtd", "Receita"]}
              rows={report.products.topByQuantity
                .slice(0, 8)
                .map((p) => [p.name, p.quantity.toString(), formatBRL(p.revenueInCents)])}
            />
          )}
        </ReportCard>
      </section>

      {/* Top clientes + leads */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ReportCard
          title={`Top clientes · ${report.customers.newCustomers} novos no período`}
        >
          {report.customers.topCustomers.length === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Cliente", "Pedidos", "Gasto"]}
              rows={report.customers.topCustomers
                .slice(0, 8)
                .map((c) => [
                  c.name,
                  c.orderCount.toString(),
                  formatBRL(c.totalSpentInCents),
                ])}
            />
          )}
        </ReportCard>
        <ReportCard
          title={`Leads · conversão ${(report.leads.conversionRate * 100).toFixed(1)}%`}
        >
          {report.leads.totalLeads === 0 ? (
            <Empty />
          ) : (
            <Table
              headers={["Status", "Qtd"]}
              rows={report.leads.byStatus.map((l) => [
                STATUS_LABEL[l.status] ?? l.status,
                l.count.toString(),
              ])}
            />
          )}
        </ReportCard>
      </section>

      {/* Estoque */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ReportCard
          title={`Sem estoque · ${report.stock.zeroStock.length}`}
          tone={report.stock.zeroStock.length > 0 ? "danger" : undefined}
        >
          {report.stock.zeroStock.length === 0 ? (
            <p className="text-ink-3 text-[12.5px]">Tudo em dia.</p>
          ) : (
            <ul className="space-y-1 text-[12.5px]">
              {report.stock.zeroStock.slice(0, 12).map((s) => (
                <li key={s.id} className="text-ink-2">
                  · {s.name}
                </li>
              ))}
            </ul>
          )}
        </ReportCard>
        <ReportCard
          title={`Estoque baixo · ${report.stock.lowStock.length}`}
          tone={report.stock.lowStock.length > 0 ? "warn" : undefined}
        >
          {report.stock.lowStock.length === 0 ? (
            <p className="text-ink-3 text-[12.5px]">Tudo em dia.</p>
          ) : (
            <ul className="space-y-1 text-[12.5px]">
              {report.stock.lowStock.slice(0, 12).map((s) => (
                <li key={s.id} className="text-ink-2">
                  · {s.name}{" "}
                  <span className="text-ink-4 mono">({s.quantity})</span>
                </li>
              ))}
            </ul>
          )}
        </ReportCard>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div className="b3-card b3-card-pad">
      <div className="text-ink-4 text-[11px] tracking-[0.06em] uppercase">
        {label}
      </div>
      <div
        className="mono mt-2 text-[24px] font-bold tabular-nums tracking-[-0.02em]"
        style={{ color: tone === "brand" ? "var(--brand)" : "var(--ink-1)" }}
      >
        {value}
      </div>
    </div>
  );
}

function ReportCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "danger" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div className="b3-card b3-card-pad">
      <h3
        className="text-[14px] font-bold"
        style={{
          color:
            tone === "danger"
              ? "var(--danger)"
              : tone === "warn"
                ? "var(--warn)"
                : "var(--ink-1)",
        }}
      >
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-ink-3 text-[12.5px]">Sem dados no período.</p>;
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="b3-tbl w-full">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "text-ink-1" : "mono text-ink-3"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
