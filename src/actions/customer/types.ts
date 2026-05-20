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

export interface CustomerDetail {
  customer: Customer;
  orderCount: number;
  recentOrders: CustomerOrderRow[];
}
