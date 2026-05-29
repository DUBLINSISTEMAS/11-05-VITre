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

export interface MarginReportTotals {
  totalRevenueInCents: number;
  totalCostInCents: number;
  totalMarginInCents: number;
  /** Taxas reais de cartão no período, calculadas a partir de order_payment. */
  paymentFeesInCents: number;
  /**
   * Lucro líquido = margem - taxas de cartão. NULL quando há produto sem
   * custo completo, porque a margem bruta já é parcial.
   */
  netProfitInCents: number | null;
  netProfitPercent: number | null;
  /** Margem % global (apenas linhas com custo 100% cadastrado). */
  overallMarginPercent: number | null;
  productsWithCost: number;
  productsTotal: number;
}

/** Agregado pra DRE simplificado. */
export interface DreSimpleSummary {
  /** Receita bruta = SUM(item.price_snapshot * qty) das vendas no período. */
  grossRevenueInCents: number;
  /** Descontos concedidos no período. */
  discountsInCents: number;
  /**
   * Acréscimos cobrados — taxas cartão/PIX, embalagem, "fechar redondo".
   * Sprint 2.3: frete saiu daqui pra `shippingInCents` (repasse, não receita).
   */
  surchargesInCents: number;
  /**
   * Sprint 2.3: frete cobrado do cliente e repassado pra transportadora.
   * Aparece como linha separada "Repasses (frete)" no DRE. NÃO entra
   * na receita líquida.
   */
  shippingInCents: number;
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
  /**
   * S2.3 (2026-05-26) — despesas operacionais do período (somatório
   * de expense.amount_in_cents com paid_at no range). Inclui aluguel,
   * salário, comissão, taxa de cartão real, etc.
   */
  operatingExpensesInCents: number;
  /**
   * S2.3 — breakdown por categoria de despesa. UI renderiza linha-a-linha
   * "(-) Aluguel R$ X · Salário R$ Y · ...".
   */
  operatingExpensesByCategory: Array<{
    category:
      | "rent"
      | "payroll"
      | "utilities"
      | "supplies"
      | "marketing"
      | "tax"
      | "card_fees"
      | "other";
    amountInCents: number;
  }>;
  /**
   * Onda 2 (2026-05-28) — comissão de vendedoras devida no período.
   * Vem de SUM(order_item.commission_snapshot_in_cents). Snapshot fixo
   * (mesmo se lojista mudar % depois). NULL não acontece — sempre 0+.
   *
   * NÃO é somada em operatingExpensesInCents (que vem de `expense`):
   * comissão tem cálculo automático no INSERT da venda, despesa é
   * lançamento manual. Linha própria no waterfall.
   */
  sellerCommissionInCents: number;
  /**
   * S2.3 — lucro OPERACIONAL = lucro bruto - despesas operacionais
   *                            - comissão de vendedoras.
   * Destaque do DRE substitui "lucro bruto". Se = grossProfit (sem
   * despesa cadastrada), UI mostra warning "cadastre despesas".
   */
  operationalProfitInCents: number;
}

export type SalesReport = {
  totalSales: number;
  totalRevenueInCents: number;
  averageTicketInCents: number;
  byChannel: {
    channel: "whatsapp" | "balcao";
    count: number;
    revenueInCents: number;
  }[];
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
  byStatus: {
    status: "new" | "contacted" | "converted" | "lost";
    count: number;
  }[];
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
