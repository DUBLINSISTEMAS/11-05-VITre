// Tipos exportados do módulo cash-session — separados de load.ts para
// obedecer a regra do Next 15: arquivo "use server" só pode exportar
// funções async.
import type { CashSession } from "@/db/schema";

export interface CashSessionSummary {
  session: CashSession;
  cashSalesInCents: number;
  // Saídas (ADR-0034 Camada 4 — 4 tipos que subtraem do esperado).
  sangriaInCents: number;
  paySupplierInCents: number;
  payBillInCents: number;
  otherOutInCents: number;
  // Entradas (2 tipos que somam ao esperado).
  reinforcementInCents: number;
  otherInInCents: number;
  /**
   * Onda 1.2 (2026-05-21): expected agora considera os 6 tipos de
   * adjustment, não só sangria/reinforcement. Fórmula:
   *   opening + cashSales
   *     + (reinforcement + other_in)
   *     − (sangria + pay_supplier + pay_bill + other_out)
   */
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
