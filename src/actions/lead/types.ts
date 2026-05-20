// Tipos exportados do módulo lead — separados de load.ts para obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.

export type LeadRow = {
  id: string;
  productId: string | null;
  productName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerId: string | null;
  customerDisplayName: string | null;
  source: "pdp_button" | "list_button" | "cart_button" | "other";
  status: "new" | "contacted" | "converted" | "lost";
  notes: string | null;
  createdAt: Date;
};

export type LeadStats = {
  total: number;
  newToday: number;
  convertedThisMonth: number;
};
