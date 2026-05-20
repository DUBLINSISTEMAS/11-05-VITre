// Tipos exportados do módulo reports — separados de load.ts para obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.

import type { Order } from "@/db/schema";

type OrderChannel = Order["channel"];
type OrderStatus = Order["status"];

export type ReportPeriod = "7" | "30" | "90" | "custom";

export type ReportRange = {
  start: Date;
  end: Date;
  periodLabel: string;
};

// =====================================================================
// Sprint 5 — relatórios A4 dedicados (vendas, top, margem, dre, fiado).
// =====================================================================

export type PaymentMethodFilter =
  | "all"
  | "cash"
  | "pix"
  | "debit"
  | "credit"
  | "other";

/** 1 linha do relatório /admin/relatorios/vendas. */
export interface SalesReportRow {
  id: string;
  shortCode: string;
  createdAt: Date;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: string | null;
  customerName: string;
  totalInCents: number;
}

export interface SalesReportSummary {
  totalCount: number;
  totalRevenueInCents: number;
  averageTicketInCents: number;
  byChannel: {
    channel: OrderChannel;
    count: number;
    revenueInCents: number;
  }[];
  byPaymentMethod: {
    method: string | null;
    count: number;
    revenueInCents: number;
  }[];
}

/** 1 linha do relatório /admin/relatorios/top. */
export interface TopProductRow {
  productId: string | null;
  productName: string;
  /** Quantidade vendida total no período. */
  quantitySold: number;
  /** Receita gerada (soma price * qty dos itens). */
  revenueInCents: number;
}

/** 1 linha do relatório /admin/relatorios/margem. */
export interface MarginReportRow {
  productId: string | null;
  productName: string;
  quantitySold: number;
  revenueInCents: number;
  /** Custo total = SUM(unit_cost_snapshot * qty). NULL = sem custo cadastrado. */
  totalCostInCents: number | null;
  /** Margem absoluta = revenue - cost. NULL se sem custo. */
  marginInCents: number | null;
  /** Margem % = margin / revenue * 100. NULL se sem custo. */
  marginPercent: number | null;
  /** Quantidade de itens vendidos COM custo cadastrado (pra aviso "X de Y produtos têm custo"). */
  itemsWithCost: number;
  /** Quantidade total de itens (com OU sem custo). */
  itemsTotal: number;
}

/** Agregado pra DRE simplificado. */
export interface DreSimpleSummary {
  /** Receita bruta = SUM(order.total) das vendas confirmadas no período. */
  grossRevenueInCents: number;
  /** Descontos concedidos no período. */
  discountsInCents: number;
  /** Acréscimos cobrados (taxas cartão, frete). */
  surchargesInCents: number;
  /** Receita líquida = bruta + acréscimos - descontos. */
  netRevenueInCents: number;
  /** CMV = soma de unit_cost_snapshot * qty pra todos os items vendidos. */
  cogsInCents: number;
  /** Lucro bruto = receita líquida - CMV. */
  grossProfitInCents: number;
  /** % itens com custo cadastrado — qualifica a precisão do CMV. */
  cogsCoveragePercent: number;
  totalOrderCount: number;
}

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
