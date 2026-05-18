import {
  loadActiveCashSession,
  loadCashSessionsList,
} from "@/actions/cash-session/load";
import {
  type DaySaleRow,
  type DaySummary,
  loadBalcaoDaySummary,
  type PaymentMethodKey,
} from "@/actions/order/balcao/load-day-summary";
import { CashSessionLanding } from "@/components/admin/pdv/cash-session-landing";
import { PrintButton } from "@/components/admin/pdv/print-button";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface CaixaPageProps {
  searchParams: Promise<{ data?: string }>;
}

const METHOD_LABEL: Record<PaymentMethodKey, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outros",
  unknown: "Sem método",
};

/**
 * Cor canônica por método (handoff B3CaixaScreen bagy-routes.jsx:79-84).
 * `unknown` fica neutro (ink-4).
 */
const METHOD_COLOR: Record<PaymentMethodKey, string> = {
  pix: "var(--brand)",
  cash: "var(--ok)",
  debit: "var(--warn)",
  credit: "#6B2A8C",
  other: "var(--ink-4)",
  unknown: "var(--ink-4)",
};

/**
 * Página "Caixa do dia" — Onda A.12 pixel-perfect Dublin v3 (B3CaixaScreen).
 *
 * Layout handoff:
 *  - H1 "Caixa do dia" + meta "DDD DD MMM · N vendas balcão"
 *  - CTA "Imprimir fechamento" b3-btn--cta no canto direito
 *  - KPI cards auto-fit minmax(180px, 1fr) — 1 por método com cor + total
 *    mono 20px + count + barra de progresso proporcional ao topo do dia
 *  - b3-card com b3-tbl: HORA mono / RECIBO mono brand / CLIENTE / PAGAMENTO pill /
 *    TOTAL mono right
 *
 * Não fecha caixa de verdade (não trava operações) — só conferência.
 * Sessão formal de caixa (abrir/fechar/sangria/Z) fica como gap Onda B.8 / ADR-0024.
 */
export default async function CaixaPage({ searchParams }: CaixaPageProps) {
  const { data: dateParam } = await searchParams;
  const [summary, activeSession, sessionsList] = await Promise.all([
    loadBalcaoDaySummary({ date: dateParam }),
    loadActiveCashSession(),
    loadCashSessionsList(10),
  ]);

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Caixa
          </h1>
          {summary ? (
            <div className="text-ink-4 mt-1 text-[13px]">
              {formatDateLabel(summary.date)} · {summary.totalCount}{" "}
              {summary.totalCount === 1 ? "venda balcão" : "vendas balcão"} no dia
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <DateForm currentDate={summary?.date} />
          <PrintButton />
        </div>
      </div>

      {/* ADR-0022 — Caixa formal (sessão aberta + histórico) */}
      <CashSessionLanding
        active={
          activeSession
            ? {
                id: activeSession.session.id,
                openedAt: activeSession.session.openedAt,
                openingAmountInCents:
                  activeSession.session.openingAmountInCents,
                cashSalesInCents: activeSession.cashSalesInCents,
                sangriaInCents: activeSession.sangriaInCents,
                reinforcementInCents: activeSession.reinforcementInCents,
                expectedInCents: activeSession.expectedInCents,
                saleCount: activeSession.saleCount,
              }
            : null
        }
        history={sessionsList.map((s) => ({
          id: s.id,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openingAmountInCents: s.openingAmountInCents,
          closingActualInCents: s.closingActualInCents,
        }))}
      />

      {/* Visão geral do dia (independente de caixa) — KPIs + tabela */}
      <section className="space-y-4 print:hidden">
        <div>
          <h2 className="text-ink-1 text-[16px] font-semibold tracking-[-0.015em]">
            Vendas do dia · visão por método
          </h2>
          <p className="text-ink-4 text-[12px]">
            Resumo independente de caixa — inclui PIX/cartão que não passam
            pela gaveta física.
          </p>
        </div>
        {summary ? <SummaryView summary={summary} /> : <EmptyState />}
      </section>

      {/* Resumo print (preservado pra fechamento informal sem caixa formal) */}
      <div className="hidden print:block">
        {summary ? <SummaryView summary={summary} /> : null}
      </div>
    </div>
  );
}

function DateForm({ currentDate }: { currentDate?: string }) {
  return (
    <form
      method="get"
      action="/admin/pdv/caixa"
      className="flex items-center gap-2"
    >
      <input
        id="caixa-date"
        type="date"
        name="data"
        defaultValue={currentDate}
        className="border-line bg-surface focus:border-brand h-9 rounded-[8px] border px-3 text-[13px] outline-none"
      />
      <button type="submit" className="b3-btn b3-btn--sm">
        Atualizar
      </button>
    </form>
  );
}

function SummaryView({ summary }: { summary: DaySummary }) {
  // Ordem canônica do handoff: PIX > Dinheiro > Débito > Crédito > Outros > Sem método
  const order: PaymentMethodKey[] = [
    "pix",
    "cash",
    "debit",
    "credit",
    "other",
    "unknown",
  ];
  const byMethodMap = new Map(summary.byMethod.map((m) => [m.method, m]));
  const topMethodTotal = Math.max(
    1,
    ...summary.byMethod.map((m) => m.total),
  );

  return (
    <div className="space-y-4">
      {/* KPI cards por método */}
      {summary.byMethod.length > 0 ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          {order
            .filter((m) => byMethodMap.has(m))
            .map((m) => {
              const row = byMethodMap.get(m)!;
              const color = METHOD_COLOR[m];
              const pct = (row.total / topMethodTotal) * 100;
              return (
                <div key={m} className="b3-card b3-card-pad">
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.06em]"
                    style={{ color, marginBottom: 6 }}
                  >
                    {METHOD_LABEL[m]}
                  </div>
                  <div
                    className="mono text-[20px] font-bold"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {formatBRL(row.total)}
                  </div>
                  <div className="text-ink-4 mt-1 text-[12px]">
                    {row.count} {row.count === 1 ? "venda" : "vendas"}
                  </div>
                  <div
                    className="mt-3 h-1 overflow-hidden rounded-[2px]"
                    style={{ background: color + "26" }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}

      {/* Tabela de vendas individuais */}
      <div className="b3-card overflow-hidden">
        <div className="b3-card-hd">
          <h3>
            Vendas do dia · {summary.totalCount}
          </h3>
        </div>
        {summary.sales.length === 0 ? (
          <div className="text-ink-4 p-8 text-center text-sm">
            Sem vendas balcão registradas neste dia.
          </div>
        ) : (
          <table className="b3-tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>HORA</th>
                <th>RECIBO</th>
                <th>CLIENTE</th>
                <th>PAGAMENTO</th>
                <th style={{ textAlign: "right", paddingRight: 20 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {summary.sales.map((s) => (
                <SaleRow key={s.id} sale={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-ink-4 print:hidden text-xs">
        Confira o dinheiro da gaveta com o total Dinheiro. PIX/POS passam pela
        conta/maquineta do lojista — registro aqui é só metadado.
      </p>

      {/* Resumo no fim do papel impresso (oculto na tela) */}
      <div className="hidden print:block">
        <div className="mt-4 border-t border-line pt-3 text-[13px]">
          <div className="flex justify-between">
            <span>Total geral</span>
            <span className="mono font-bold">
              {formatBRL(summary.totalCents)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaleRow({ sale }: { sale: DaySaleRow }) {
  return (
    <tr>
      <td
        className="mono text-ink-4"
        style={{ paddingLeft: 20, fontSize: 12 }}
      >
        {sale.hour}
      </td>
      <td>
        <span
          className="mono text-brand font-semibold"
          style={{ fontSize: 12.5 }}
        >
          BLC-{sale.shortCode}
        </span>
      </td>
      <td>{sale.customerName}</td>
      <td>
        <span className="b3-pill">{METHOD_LABEL[sale.method]}</span>
      </td>
      <td
        className="mono font-bold"
        style={{ textAlign: "right", paddingRight: 20 }}
      >
        {formatBRL(sale.totalInCents)}
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="b3-card b3-card-pad text-ink-4 text-center text-sm">
      Loja não encontrada ou data inválida.
    </div>
  );
}

/** "2026-05-18" → "seg 18 mai" (handoff format). */
function formatDateLabel(iso: string): string {
  const [yyyy, mm, dd] = iso.split("-").map(Number);
  if (!yyyy || !mm || !dd) return iso;
  const d = new Date(yyyy, mm - 1, dd);
  const weekday = d
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();
  const month = d
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toLowerCase();
  return `${weekday} ${String(dd).padStart(2, "0")} ${month}`;
}

