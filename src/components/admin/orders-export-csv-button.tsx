"use client";

// Botão "Exportar CSV" no header de /admin/pedidos — handoff Passo 6.
//
// Limitação consciente: exporta apenas a PÁGINA atual (mesmo set passado
// pra OrdersTable). Pra exportar o set inteiro do filtro, seria preciso
// route handler que re-roda a query server-side — defer pro Bloco 12 P1
// do CLAUDE.md (universalizar TableActions com print + CSV em todas as
// telas Grupo 3). Hoje a régua "funciona ou esconde" tá satisfeita: o
// botão entrega CSV real (não placeholder), só limitado em escopo.

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { formatBRL } from "@/lib/pricing";

import type { OrderTableRow } from "./orders-table";

interface OrdersExportCsvButtonProps {
  orders: ReadonlyArray<OrderTableRow>;
  /** Usado pra montar o nome do arquivo (sem extensão). */
  storeSlug: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  balcao: "Balcão",
  whatsapp: "Loja online",
};

const STATUS_LABEL: Record<string, string> = {
  quote: "Orçamento",
  awaiting_whatsapp: "Aguardando WhatsApp",
  confirmed: "Confirmada",
  fulfilled: "Entregue",
  canceled: "Cancelada",
  expired: "Expirada",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

export function OrdersExportCsvButton({
  orders,
  storeSlug,
}: OrdersExportCsvButtonProps) {
  const handleExport = () => {
    const headers = [
      "Código",
      "Cliente",
      "Telefone",
      "Canal",
      "Status",
      "Pagamento",
      "Total",
      "Fiado em aberto",
      "Criado em",
    ];
    const rows = orders.map((o) => {
      const channel = o.channel ?? "whatsapp";
      const paymentCount = o.paymentCount ?? 0;
      const creditOutstanding = o.creditOutstandingInCents ?? 0;
      const paymentLabel =
        paymentCount > 1
          ? "Misto"
          : o.paymentMethod
            ? PAYMENT_LABEL[o.paymentMethod] ?? "—"
            : "—";
      return [
        `#${o.shortCode}`,
        o.customerName,
        o.customerPhone ?? "",
        CHANNEL_LABEL[channel] ?? channel,
        STATUS_LABEL[o.status] ?? o.status,
        paymentLabel,
        formatBRL(o.totalInCents),
        creditOutstanding > 0 ? formatBRL(creditOutstanding) : "",
        o.createdAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ];
    });
    const csv = buildCsv(headers, rows);
    const today = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    downloadCsv(`vendas-${storeSlug}-${today}`, csv);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={orders.length === 0}
      aria-label="Exportar página atual em CSV"
      title={
        orders.length === 0
          ? "Nada pra exportar"
          : "Baixa a página atual em CSV (separador ;)"
      }
    >
      <DownloadIcon className="size-3.5" aria-hidden /> Exportar CSV
    </Button>
  );
}
