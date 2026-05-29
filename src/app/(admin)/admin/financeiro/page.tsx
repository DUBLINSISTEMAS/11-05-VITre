/**
 * /admin/financeiro — Onda L2 (2026-05-29).
 *
 * Tela unica que substitui /admin/financeiro/receber e /admin/financeiro/pagar.
 * Founder pediu "planilha financeira" — tudo que entra e sai num lugar so.
 *
 * Estrutura:
 *   - FinanceiroOverview (header centralizado)
 *       H1 + sub + 2 CTAs verbais ("Lançar fiado", "Lançar despesa")
 *       4 KPIs: Recebido / Pago / Saldo do mês (destaque) / Em aberto
 *   - FinanceiroTabs ("A receber" | "A pagar")
 *   - Painel correspondente:
 *       receber -> ReceivablesPanel (lista de fiados + standalone dialog)
 *       pagar   -> ExpensesPageClient embedded (lista de despesas + form)
 *
 * Tab default: receber (?tab=receber omitido). Persiste em URL pra deep-link.
 *
 * As rotas antigas (`/receber` e `/pagar`) viraram redirects pra
 * `/admin/financeiro?tab=*` — preservam links externos sem manter codigo
 * duplicado.
 */
import { loadExpenses } from "@/actions/expense/load";
import { loadFinanceiroOverview } from "@/actions/financeiro/load-overview";
import { loadPendingReceivables } from "@/actions/receivable/load-pending";
import { loadSuppliers } from "@/actions/supplier";
import { ExpensesPageClient } from "@/components/admin/expenses-page-client";
import { FinanceiroDialogsHost } from "@/components/admin/financeiro-dialogs-host";
import { FinanceiroOverview } from "@/components/admin/financeiro-overview";
import {
  type FinanceiroTab,
  FinanceiroTabs,
} from "@/components/admin/financeiro-tabs";
import { ReceivablesPanel } from "@/components/admin/receivables-panel";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): FinanceiroTab {
  return raw === "pagar" ? "pagar" : "receber";
}

interface FinanceiroPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function FinanceiroPage({
  searchParams,
}: FinanceiroPageProps) {
  await requireSession();
  const params = await searchParams;
  const tab = parseTab(params.tab);

  // Carrega TUDO em paralelo. Overview e listas vivem na mesma tela —
  // sem renderizacao parcial entre tabs (UI fica responsiva).
  const [overview, receivables, expensesResult, suppliers] = await Promise.all([
    loadFinanceiroOverview(),
    loadPendingReceivables(),
    loadExpenses({
      category: params.category as
        | "rent"
        | "payroll"
        | "utilities"
        | "supplies"
        | "marketing"
        | "tax"
        | "card_fees"
        | "other"
        | undefined,
      paid: (params.paid as "all" | "paid" | "pending") ?? "all",
    }),
    loadSuppliers(),
  ]);

  const suppliersList = suppliers.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <FinanceiroOverview overview={overview} />

      <FinanceiroTabs
        current={tab}
        pendenteReceberInCents={overview.pendenteReceberInCents}
        pendentePagarInCents={overview.pendentePagarInCents}
      />

      {tab === "receber" ? (
        <ReceivablesPanel
          rows={receivables.rows}
          totals={receivables.totals}
        />
      ) : (
        <ExpensesPageClient
          embedded
          initialData={expensesResult}
          suppliers={suppliersList}
          initialFilters={{
            from: params.from,
            to: params.to,
            category: params.category,
            paid: (params.paid as "all" | "paid" | "pending") ?? "all",
          }}
        />
      )}

      {/* Onda R5 — host global. Os 2 CTAs do header (Lançar fiado /
          Lançar despesa) abrem aqui INDEPENDENTE da tab ativa.
          Founder reportou que despesa "nao abria" da tab "receber". */}
      <FinanceiroDialogsHost suppliers={suppliersList} />
    </div>
  );
}
