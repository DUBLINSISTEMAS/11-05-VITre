import { ArrowLeftIcon, LockIcon, LockOpenIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCashSessionDetail } from "@/actions/cash-session/load";
import { PrintButton } from "@/components/admin/pdv/print-button";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface CashSessionDetailPageProps {
  params: Promise<{ id: string }>;
}

const ADJ_LABEL: Record<string, string> = {
  sangria: "Sangria",
  reinforcement: "Reforço",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outros",
};

/**
 * Z de caixa (ADR-0022 D4) — página dedicada por sessão, imprimível.
 * Aberta: mostra "Z parcial" (live snapshot, esperado calculado live).
 * Fechada: mostra Z final com snapshot histórico (closing_expected gravado
 * no fechamento).
 */
export default async function CashSessionDetailPage({
  params,
}: CashSessionDetailPageProps) {
  await requireSession();
  const { id } = await params;
  const detail = await loadCashSessionDetail(id);
  if (!detail) notFound();

  const isClosed = detail.session.closedAt !== null;
  const closingExpected =
    detail.session.closingExpectedInCents ?? detail.expectedInCents;
  const closingActual = detail.session.closingActualInCents;
  const delta =
    closingActual !== null ? closingActual - closingExpected : null;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/pdv/caixa"
            aria-label="Voltar"
            className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
          >
            <ArrowLeftIcon size={15} />
          </Link>
          <div>
            <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
              {isClosed ? "Z de caixa" : "Z parcial · caixa em andamento"}
            </h1>
            <p className="text-ink-4 mt-1 text-[13px]">
              Aberto em {formatDateTime(detail.session.openedAt)}
              {isClosed && detail.session.closedAt
                ? ` · fechado em ${formatDateTime(detail.session.closedAt)}`
                : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isClosed ? (
            <span className="b3-pill flex items-center gap-1">
              <LockIcon size={11} aria-hidden /> Fechado
            </span>
          ) : (
            <span className="b3-pill b3-pill--warn flex items-center gap-1">
              <LockOpenIcon size={11} aria-hidden /> Em aberto
            </span>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Bloco principal imprimível */}
      <div className="b3-card space-y-4 p-5 print:border-0 print:shadow-none">
        {/* Header impressão */}
        <header className="border-line hidden border-b pb-3 print:block">
          <h2 className="text-[16px] font-bold">
            {isClosed ? "Z de caixa" : "Z parcial"}
          </h2>
          <p className="text-[12px]">
            Aberto em {formatDateTime(detail.session.openedAt)}
            {isClosed && detail.session.closedAt
              ? ` · fechado em ${formatDateTime(detail.session.closedAt)}`
              : null}
          </p>
        </header>

        {/* Resumo financeiro */}
        <section className="space-y-2">
          <h3 className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Resumo
          </h3>
          <dl className="space-y-1.5 text-[13px]">
            <Row label="Abertura (troco inicial)">
              {formatBRL(detail.session.openingAmountInCents)}
            </Row>
            <Row label={`Vendas em dinheiro (${detail.saleCount})`} accent="ok">
              + {formatBRL(detail.cashSalesInCents)}
            </Row>
            <Row label="Sangria" accent="danger">
              − {formatBRL(detail.sangriaInCents)}
            </Row>
            <Row label="Reforço" accent="warn">
              + {formatBRL(detail.reinforcementInCents)}
            </Row>
            <div className="border-line my-1 border-t" />
            <Row label="Esperado em dinheiro" strong>
              {formatBRL(closingExpected)}
            </Row>
            {closingActual !== null ? (
              <>
                <Row label="Contagem física" strong>
                  {formatBRL(closingActual)}
                </Row>
                <Row
                  label="Diferença"
                  strong
                  accent={
                    delta === 0
                      ? "ok"
                      : (delta ?? 0) > 0
                        ? "warn"
                        : "danger"
                  }
                >
                  {delta === 0
                    ? "OK"
                    : (delta! > 0 ? "+" : "−") + formatBRL(Math.abs(delta!))}
                </Row>
              </>
            ) : null}
          </dl>
        </section>

        {/* Observações de fechamento */}
        {detail.session.closingNotes ? (
          <section className="space-y-1">
            <h3 className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
              Observações
            </h3>
            <p className="text-ink-1 text-[13px] leading-relaxed">
              {detail.session.closingNotes}
            </p>
          </section>
        ) : null}

        {/* Movimentações de caixa */}
        {detail.adjustments.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
              Movimentações
            </h3>
            <ul className="border-line divide-line divide-y rounded-[8px] border">
              {detail.adjustments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2 text-[12.5px]"
                >
                  <span
                    className={`b3-pill ${
                      a.type === "sangria"
                        ? "b3-pill--danger"
                        : "b3-pill--warn"
                    }`}
                  >
                    {ADJ_LABEL[a.type]}
                  </span>
                  <span className="text-ink-4 mono shrink-0 text-[11.5px]">
                    {formatTime(a.createdAt)}
                  </span>
                  <span className="text-ink-1 min-w-0 flex-1 truncate">
                    {a.reason ?? "—"}
                  </span>
                  <span
                    className={`mono font-semibold ${
                      a.type === "sangria" ? "text-danger" : "text-warn"
                    }`}
                  >
                    {a.type === "sangria" ? "−" : "+"}
                    {formatBRL(a.amountInCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Vendas balcão da sessão */}
        {detail.sales.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
              Vendas balcão ({detail.sales.length})
            </h3>
            <ul className="border-line divide-line divide-y rounded-[8px] border">
              {detail.sales.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 text-[12.5px]"
                >
                  <span className="text-ink-4 mono shrink-0 text-[11.5px]">
                    {formatTime(s.createdAt)}
                  </span>
                  <span className="text-brand mono shrink-0 font-semibold">
                    BLC-{s.shortCode}
                  </span>
                  <span className="text-ink-1 min-w-0 flex-1 truncate">
                    {s.customerName ?? "—"}
                  </span>
                  {s.paymentMethod ? (
                    <span className="b3-pill">
                      {METHOD_LABEL[s.paymentMethod] ?? s.paymentMethod}
                    </span>
                  ) : null}
                  <span className="mono text-ink-1 font-semibold">
                    {formatBRL(s.totalInCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-ink-4 text-[12px]">
            Nenhuma venda balcão registrada nesta sessão.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  strong,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
  accent?: "ok" | "danger" | "warn";
}) {
  const accentClass =
    accent === "ok"
      ? "text-ok"
      : accent === "danger"
        ? "text-danger"
        : accent === "warn"
          ? "text-warn"
          : "text-ink-1";
  return (
    <div className="flex items-center justify-between">
      <span className={`text-ink-4 ${strong ? "font-medium" : ""}`}>
        {label}
      </span>
      <span
        className={`mono ${accentClass} ${strong ? "font-bold" : "font-medium"}`}
      >
        {children}
      </span>
    </div>
  );
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
