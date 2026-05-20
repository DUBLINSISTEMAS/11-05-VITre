// Tipos exportados do módulo cash-session — separados de load.ts para
// obedecer a regra do Next 15: arquivo "use server" só pode exportar
// funções async.
import type { CashSession } from "@/db/schema";

export interface CashSessionSummary {
  session: CashSession;
  cashSalesInCents: number;
  sangriaInCents: number;
  reinforcementInCents: number;
  /** opening + cashSales - sangria + reinforcement (calculado live) */
  expectedInCents: number;
  /** quantidade de vendas balcão (todos métodos) da sessão */
  saleCount: number;
}

export interface CashSessionListRow {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  openingAmountInCents: number;
  closingActualInCents: number | null;
}
