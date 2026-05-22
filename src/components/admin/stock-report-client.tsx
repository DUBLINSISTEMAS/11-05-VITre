"use client";

/**
 * ADR-0034 Camada 2 Onda D — Wrapper client de /admin/estoque/relatorio.
 *
 * Recebe rows + storeInfo do server, monta colunas/totals e renderiza
 * <ReportLayout />. Separado em client porque ReportLayout usa
 * window.print() + URL.createObjectURL pra CSV.
 */

import {
  type ReportColumn,
  ReportLayout,
  type ReportStoreInfo,
  type ReportTotal,
} from "./report/report-layout";

interface StockRow {
  id: string;
  name: string;
  brand: string | null;
  internalCode: string | null;
  gtin: string | null;
  unit: string;
  stockQuantity: number | null;
  basePriceInCents: number;
  costPriceInCents: number | null;
}

interface StockReportClientProps {
  rows: StockRow[];
  storeInfo: ReportStoreInfo;
  /** Sprint 4.8 — operador no rodapé. */
  operatorName?: string | null;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatQty(qty: number | null, unit: string): string {
  if (qty === null) return "—";
  return `${qty.toLocaleString("pt-BR")} ${unit}`;
}

export function StockReportClient({
  rows,
  storeInfo,
  operatorName,
}: StockReportClientProps) {
  const columns: ReportColumn<StockRow>[] = [
    {
      key: "ref",
      label: "Ref.",
      align: "left",
      width: "100px",
      render: (r) => r.internalCode ?? r.gtin ?? "—",
      exportValue: (r) => r.internalCode ?? r.gtin ?? "",
    },
    {
      key: "name",
      label: "Produto",
      align: "left",
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          {r.brand ? (
            <div className="text-[10px] text-ink-4">{r.brand}</div>
          ) : null}
        </div>
      ),
      exportValue: (r) => `${r.name}${r.brand ? ` (${r.brand})` : ""}`,
    },
    {
      key: "qty",
      label: "Estoque",
      align: "right",
      width: "100px",
      render: (r) => formatQty(r.stockQuantity, r.unit),
      exportValue: (r) =>
        r.stockQuantity === null ? "" : `${r.stockQuantity} ${r.unit}`,
    },
    {
      key: "unit-price",
      label: "Valor unit.",
      align: "right",
      width: "100px",
      render: (r) => formatBRL(r.basePriceInCents),
      exportValue: (r) => (r.basePriceInCents / 100).toFixed(2),
    },
    {
      key: "total-price",
      label: "Valor total (venda)",
      align: "right",
      width: "130px",
      render: (r) => {
        if (r.stockQuantity === null) return "—";
        return formatBRL(r.stockQuantity * r.basePriceInCents);
      },
      exportValue: (r) =>
        r.stockQuantity === null
          ? ""
          : ((r.stockQuantity * r.basePriceInCents) / 100).toFixed(2),
    },
    {
      key: "total-cost",
      label: "Valor total (custo)",
      align: "right",
      width: "130px",
      hideOnPrint: false,
      render: (r) => {
        if (r.stockQuantity === null || r.costPriceInCents === null) return "—";
        return formatBRL(r.stockQuantity * r.costPriceInCents);
      },
      exportValue: (r) =>
        r.stockQuantity === null || r.costPriceInCents === null
          ? ""
          : ((r.stockQuantity * r.costPriceInCents) / 100).toFixed(2),
    },
  ];

  // Totais: itens distintos + soma de unidades + valor total (venda + custo)
  const totalProducts = rows.length;
  const totalUnits = rows.reduce(
    (sum, r) => sum + (r.stockQuantity ?? 0),
    0,
  );
  const totalSaleValue = rows.reduce(
    (sum, r) => sum + (r.stockQuantity ?? 0) * r.basePriceInCents,
    0,
  );
  const totalCostValue = rows.reduce(
    (sum, r) =>
      sum + (r.stockQuantity ?? 0) * (r.costPriceInCents ?? 0),
    0,
  );

  const totals: ReportTotal[] = [
    {
      label: "Produtos",
      value: totalProducts.toLocaleString("pt-BR"),
    },
    {
      label: "Unidades",
      value: totalUnits.toLocaleString("pt-BR"),
    },
    {
      label: "Valor venda",
      value: formatBRL(totalSaleValue),
      emphasis: true,
    },
    {
      label: "Valor custo",
      value: totalCostValue > 0 ? formatBRL(totalCostValue) : "—",
    },
  ];

  return (
    <ReportLayout<StockRow>
      title="Relatório de Estoque"
      storeInfo={storeInfo}
      columns={columns}
      rows={rows}
      totals={totals}
      csvFileName={`estoque-${new Date().toISOString().slice(0, 10)}`}
      emptyMessage="Nenhum produto em estoque pra exibir."
      operatorName={operatorName}
      notes="Documento interno sem valor fiscal. Valores baseados em estoque atual e preços cadastrados."
    />
  );
}
