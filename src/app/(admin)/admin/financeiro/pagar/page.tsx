/**
 * /admin/financeiro/pagar — Contas a pagar (despesas operacionais).
 *
 * S2.2 do Plano de Endurecimento. Destrava DRE honesto: lojista cadastra
 * aluguel, salário, conta de luz, taxa de cartão fora de adquirente etc.
 * load-dre.ts (S2.3) agrega via expense.paid_at no período.
 *
 * Pattern: server fetch → componente client com tabela + dialog form.
 * RLS gere isolamento por loja via withTenant.
 */
import { loadExpenses } from "@/actions/expense/load";
import { loadSuppliers } from "@/actions/supplier";
import { ExpensesPageClient } from "@/components/admin/expenses-page-client";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ContasAPagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;

  const [data, suppliers] = await Promise.all([
    loadExpenses({
      from: params.from,
      to: params.to,
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

  return (
    <ExpensesPageClient
      initialData={data}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      initialFilters={{
        from: params.from,
        to: params.to,
        category: params.category,
        paid: (params.paid as "all" | "paid" | "pending") ?? "all",
      }}
    />
  );
}
