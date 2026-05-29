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
  // Onda 3 (2026-05-28): "contact_form" é gravado por submit-contact.ts
  // (formulário /[storeSlug]/contato) desde Sprint 5.2 — faltava no tipo.
  source:
    | "pdp_button"
    | "list_button"
    | "cart_button"
    | "contact_form"
    | "other";
  status: "new" | "contacted" | "converted" | "lost";
  notes: string | null;
  createdAt: Date;
};

export type LeadStats = {
  total: number;
  newToday: number;
  convertedThisMonth: number;
};
