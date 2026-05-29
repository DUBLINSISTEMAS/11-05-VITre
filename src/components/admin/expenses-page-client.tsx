"use client";

/**
 * Contas a pagar — cliente.
 *
 * S2.2 do Plano de Endurecimento. Lojista cadastra despesa operacional
 * (aluguel, salário, luz, etc.) que vai pro DRE.
 *
 * Layout: KPIs no topo, toolbar de filtros, tabela.
 * Dialog pra criar/editar. AlertDialog pra confirmar delete.
 */
import { Edit2,Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { OPEN_NEW_EXPENSE_EVENT } from "./financeiro-events";

import { deleteExpense } from "@/actions/expense/delete";
import type { ExpenseRow,LoadExpensesResult } from "@/actions/expense/load";
import {
  CATEGORY_LABEL_BR,
  EXPENSE_CATEGORIES,
} from "@/actions/expense/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/pricing";

import { ExpenseFormDialog } from "./expense-form-dialog";

interface ExpensesPageClientProps {
  initialData: LoadExpensesResult;
  suppliers: Array<{ id: string; name: string }>;
  initialFilters: {
    from?: string;
    to?: string;
    category?: string;
    paid?: "all" | "paid" | "pending";
  };
  /**
   * Onda L2 (2026-05-29) — quando true, esconde o page header (H1 +
   * sub + CTA "Nova despesa") e os KPIs proprios. Usado quando este
   * componente vive dentro da tela `/admin/financeiro` que ja tem
   * header + KPIs centralizados.
   */
  embedded?: boolean;
}

export function ExpensesPageClient({
  initialData,
  suppliers,
  initialFilters,
  embedded = false,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Onda R5 (2026-05-29) — listener do OPEN_NEW_EXPENSE_EVENT MOVIDO pra
  // FinanceiroDialogsHost (vive sempre montado, qualquer tab). Founder
  // reportou que despesa "nao abria" da tab "receber" porque listener
  // estava preso aqui (embedded so monta em "pagar"). Em modo standalone
  // (botao "Nova despesa" no header proprio do componente), showCreate
  // ainda funciona via state local.

  function updateFilter(key: string, value: string | undefined) {
    const usp = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "") usp.set(key, value);
    else usp.delete(key);
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  }

  async function handleDelete(id: string) {
    const result = await deleteExpense({ id });
    if (result.ok) {
      toast.success("Despesa apagada.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header — escondido em modo embedded (header centralizado vive
          em FinanceiroOverview). */}
      {!embedded ? (
        <div className="flex items-end justify-between">
          <div>
            <h1 className="b3-page-title">Contas a pagar</h1>
            <p className="b3-page-sub">
              Aluguel, salário, luz, taxa de máquina — despesas operacionais
              que o DRE precisa pra mostrar o lucro real do mês.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowCreate(true)}
            className="b3-btn b3-btn--cta"
          >
            <Plus size={14} aria-hidden />
            Nova despesa
          </Button>
        </div>
      ) : null}

      {/* KPIs — escondidos em modo embedded (centralizado). */}
      {!embedded ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="b3-card p-4">
            <p className="text-ink-3 text-xs">Pago no período</p>
            <p className="text-ink-1 mt-1 text-2xl font-semibold">
              {formatBRL(initialData.totalPaidInCents)}
            </p>
          </div>
          <div className="b3-card p-4">
            <p className="text-ink-3 text-xs">Pendente</p>
            <p className="text-ink-1 mt-1 text-2xl font-semibold">
              {formatBRL(initialData.totalPendingInCents)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={initialFilters.category ?? "all"}
          onValueChange={(v) => updateFilter("category", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-9 min-w-40 max-w-52">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL_BR[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={initialFilters.paid ?? "all"}
          onValueChange={(v) => updateFilter("paid", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-9 min-w-32 max-w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {initialData.items.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">
            Nenhuma despesa cadastrada {initialFilters.from || initialFilters.to ? "no período" : "ainda"}.
          </p>
          <p className="text-ink-4 mt-1 text-xs">
            O DRE precisa das despesas pra mostrar o lucro operacional real.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Categoria</th>
                <th className="text-left">Pagamento</th>
                <th className="text-left">Vencimento</th>
                <th className="text-right">Valor</th>
                <th className="text-left">Notas</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {initialData.items.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <span className="text-ink-1 text-sm">
                      {CATEGORY_LABEL_BR[expense.category]}
                    </span>
                    {expense.recurring ? (
                      <span className="text-ink-4 ml-2 text-[10px]">
                        recorrente
                      </span>
                    ) : null}
                  </td>
                  <td className="text-ink-2 text-sm">
                    {expense.paidAt
                      ? new Date(expense.paidAt).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td className="text-ink-2 text-sm">
                    {expense.dueDate
                      ? new Date(expense.dueDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm">
                    {formatBRL(expense.amountInCents)}
                  </td>
                  <td className="text-ink-3 max-w-xs truncate text-sm">
                    {expense.notes ?? "—"}
                  </td>
                  <td className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingExpense(expense)}
                      className="text-ink-4 hover:text-ink-1 p-1"
                      aria-label="Editar"
                    >
                      <Edit2 size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(expense.id)}
                      className="text-ink-4 hover:text-destructive p-1"
                      aria-label="Apagar"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form dialog (create + edit) */}
      <ExpenseFormDialog
        open={showCreate}
        onOpenChange={(open) => setShowCreate(open)}
        suppliers={suppliers}
        mode="create"
      />
      <ExpenseFormDialog
        open={editingExpense !== null}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        suppliers={suppliers}
        mode="edit"
        initialData={editingExpense}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se for uma despesa recorrente,
              apague-a mês a mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
