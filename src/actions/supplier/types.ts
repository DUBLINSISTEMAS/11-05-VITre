// Tipos exportados do módulo supplier — separados das actions pra obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.
import type { Supplier } from "@/db/schema";

export interface SupplierListRow {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type { Supplier };
