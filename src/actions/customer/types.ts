// Tipos exportados do módulo customer — separados de load.ts para
// obedecer a regra do Next 15: arquivo "use server" só pode exportar
// funções async.
import type { Customer } from "@/db/schema";

export interface CustomerOrderRow {
  id: string;
  shortCode: string;
  totalInCents: number;
  status: string;
  createdAt: Date;
}

/** Sprint 2B — agregados de fiado deste cliente. */
export interface CustomerFiadoSummary {
  /** Soma de receivables pendentes (paid_at IS NULL) em centavos. */
  pendingSum: number;
  /** Soma de receivables pendentes E vencidos (due_date < now). */
  overdueSum: number;
  /** Quantidade de receivables vencidos. */
  overdueCount: number;
  /** Quantidade total de receivables pendentes. */
  pendingCount: number;
}

/** Sprint 2B — linha de receivable pendente pra UI listar. */
export interface CustomerReceivableRow {
  id: string;
  amountInCents: number;
  dueDate: Date | null;
  paidAt: Date | null;
  orderId: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface CustomerDetail {
  customer: Customer;
  orderCount: number;
  recentOrders: CustomerOrderRow[];
  fiadoSummary: CustomerFiadoSummary;
  pendingReceivables: CustomerReceivableRow[];
}
