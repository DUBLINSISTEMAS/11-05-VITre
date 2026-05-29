"use client";

/**
 * FinanceiroDialogsHost — Onda R5 (2026-05-29).
 *
 * Host global dos dialogs de despesa + fiado avulso na tela
 * `/admin/financeiro`. Vive UMA vez na page, fora das tabs. Escuta os
 * eventos disparados pelos CTAs do header centralizado:
 *
 *   OPEN_NEW_EXPENSE_EVENT       -> abre <ExpenseFormDialog>
 *   OPEN_NEW_RECEIVABLE_EVENT    -> abre <StandaloneReceivableDialog>
 *
 * Founder reportou: "nao consigo lancar despesa". Diagnostico: o
 * listener anterior vivia em `ExpensesPageClient` (so montado na tab
 * "A pagar"). Se o lojista estava em "A receber" e clicava o CTA, o
 * evento disparava mas ninguem escutava. Confuso e silencioso.
 *
 * Fix: host global. CTA funciona de qualquer tab. Salvar revalida a
 * rota (router.refresh) — KPI saldo do mes e DRE atualizam imediato.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ExpenseFormDialog } from "@/components/admin/expense-form-dialog";
import { StandaloneReceivableDialog } from "@/components/admin/standalone-receivable-dialog";

import {
  OPEN_NEW_EXPENSE_EVENT,
  OPEN_NEW_RECEIVABLE_EVENT,
} from "./financeiro-events";

interface FinanceiroDialogsHostProps {
  suppliers: Array<{ id: string; name: string }>;
}

export function FinanceiroDialogsHost({ suppliers }: FinanceiroDialogsHostProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [receivableOpen, setReceivableOpen] = useState(false);

  useEffect(() => {
    const onExpense = () => setExpenseOpen(true);
    const onReceivable = () => setReceivableOpen(true);
    window.addEventListener(OPEN_NEW_EXPENSE_EVENT, onExpense);
    window.addEventListener(OPEN_NEW_RECEIVABLE_EVENT, onReceivable);
    return () => {
      window.removeEventListener(OPEN_NEW_EXPENSE_EVENT, onExpense);
      window.removeEventListener(OPEN_NEW_RECEIVABLE_EVENT, onReceivable);
    };
  }, []);

  return (
    <>
      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={(next) => setExpenseOpen(next)}
        suppliers={suppliers}
        mode="create"
      />
      {receivableOpen ? (
        <StandaloneReceivableDialog
          onClose={(didCreate) => {
            setReceivableOpen(false);
            if (didCreate) {
              startTransition(() => router.refresh());
            }
          }}
        />
      ) : null}
    </>
  );
}
