// Tipos exportados do módulo reports — separados de load.ts para obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.

type ReportPeriod = "7" | "30" | "90" | "custom";

export type ReportRange = {
  start: Date;
  end: Date;
  periodLabel: string;
};

export type SalesReport = {
  totalSales: number;
  totalRevenueInCents: number;
  averageTicketInCents: number;
  byChannel: { channel: "whatsapp" | "balcao"; count: number; revenueInCents: number }[];
  byPaymentMethod: {
    method: string | null;
    count: number;
    revenueInCents: number;
  }[];
};

export type ProductsReport = {
  topByQuantity: {
    productId: string | null;
    name: string;
    quantity: number;
    revenueInCents: number;
  }[];
  topByRevenue: {
    productId: string | null;
    name: string;
    quantity: number;
    revenueInCents: number;
  }[];
};

export type CustomersReport = {
  topCustomers: {
    customerId: string;
    name: string;
    orderCount: number;
    totalSpentInCents: number;
  }[];
  newCustomers: number;
};

export type LeadsReport = {
  totalLeads: number;
  byStatus: { status: "new" | "contacted" | "converted" | "lost"; count: number }[];
  conversionRate: number; // 0..1
};

export type StockReport = {
  zeroStock: { id: string; name: string }[];
  lowStock: { id: string; name: string; quantity: number }[];
};

export type FullReport = {
  range: ReportRange;
  sales: SalesReport;
  products: ProductsReport;
  customers: CustomersReport;
  leads: LeadsReport;
  stock: StockReport;
};
