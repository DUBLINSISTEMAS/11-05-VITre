// Tipos exportados do módulo purchase — separados das actions pra obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.
import type { Purchase, PurchaseItem } from "@/db/schema";

/** Linha da listagem /admin/compras. */
export interface PurchaseListRow {
  id: string;
  invoiceNumber: string | null;
  totalInCents: number;
  paidAt: Date | null;
  paymentMethod:
    | "cash"
    | "pix"
    | "debit"
    | "credit"
    | "other"
    | null;
  notes: string | null;
  createdAt: Date;
  supplierId: string | null;
  supplierName: string | null;
  itemCount: number;
}

/** Detalhe de 1 compra com seus items. */
export interface PurchaseDetail {
  purchase: Purchase;
  supplierName: string | null;
  items: PurchaseItem[];
}
