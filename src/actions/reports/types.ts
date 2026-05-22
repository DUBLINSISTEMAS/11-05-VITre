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
  /**
   * Sprint 1.4: total devolvido vinculado a esta venda. 0 quando nada
   * foi devolvido. UI pode mostrar "R$X devolvidos" como badge.
   */
  returnedInCents: number;
}

export interface SalesReportSummary {
  totalCount: number;
  /** Receita bruta — soma de order.total sem desconto de devolução. */
  totalRevenueInCents: number;
  /**
   * Sprint 1.4: total devolvido das vendas do período. Subtraído de
   * netRevenueInCents.
   */
  totalReturnedInCents: number;
  /** Receita líquida = totalRevenue - totalReturned. */
  netRevenueInCents: number;
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
  /** Quantidade vendida total no período (sem subtrair devolução). */
  quantitySold: number;
  /** Receita gerada (soma price * qty dos itens). */
  revenueInCents: number;
  /**
   * Sprint 1.4: quantidade devolvida no período (vinculada às vendas
   * deste período, não à data da devolução).
   */
  returnedQuantity: number;
  /** Sprint 1.4: receita devolvida = qty_returned × price_snapshot. */
  returnedRevenueInCents: number;
  /** Sprint 1.4: quantidade líquida = vendido - devolvido. */
  netQuantity: number;
  /** Sprint 1.4: receita líquida = revenue - returnedRevenue. */
  netRevenueInCents: number;
}

/** 1 linha do relatório /admin/relatorios/margem. */
export interface MarginReportRow {
  productId: string | null;
  productName: string;
  /** Quantidade vendida bruta no período. */
  quantitySold: number;
  /** Receita BRUTA (sem subtrair devolução). */
  revenueInCents: number;
  /**
   * Custo total das vendidas = SUM(unit_cost_snapshot * qty).
   * NULL = sem custo cadastrado em ao menos um item.
   */
  totalCostInCents: number | null;
  /**
   * Sprint 1.4: receita devolvida no período (qty_returned × price_snapshot).
   */
  returnedRevenueInCents: number;
  /**
   * Sprint 1.4: custo das devolvidas (qty_returned × cost_snapshot).
   * NULL = sem custo cadastrado nas devolvidas (raro).
   */
  returnedCostInCents: number | null;
  /**
   * Margem absoluta efetiva = (revenue - returnedRevenue) - (cost - returnedCost).
   * NULL se cobertura de custo < 100%.
   */
  marginInCents: number | null;
  /**
   * Margem % efetiva = margin / netRevenue * 100. NULL se sem custo.
   */
  marginPercent: number | null;
  /** Quantidade de itens vendidos COM custo cadastrado (pra aviso "X de Y produtos têm custo"). */
  itemsWithCost: number;
  /** Quantidade total de itens (com OU sem custo). */
  itemsTotal: number;
}

/** Agregado pra DRE simplificado. */
export interface DreSimpleSummary {
  /** Receita bruta = SUM(item.price_snapshot * qty) das vendas no período. */
  grossRevenueInCents: number;
  /** Descontos concedidos no período. */
  discountsInCents: number;
  /** Acréscimos cobrados (taxas cartão, frete). */
  surchargesInCents: number;
  /**
   * Sprint 1.4: receita devolvida vinculada às vendas do período.
   * = SUM(qty_returned * item.price_snapshot).
   */
  returnedRevenueInCents: number;
  /** Receita líquida = order.total - devoluções. */
  netRevenueInCents: number;
  /** CMV efetivo = (custo dos vendidos) - (custo dos devolvidos). */
  cogsInCents: number;
  /**
   * Sprint 1.4: CMV das devoluções (já subtraído de cogsInCents).
   * Reportado pra UI poder mostrar separadamente.
   */
  returnedCogsInCents: number;
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
