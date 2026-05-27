"use client";

/**
 * Botão "Exportar CSV" em /admin/pedidos.
 *
 * S4.4 (2026-05-26) — migrado de client-only (página atual) pra server
 * action `exportOrdersCsv` que aceita os MESMOS filtros da URL e gera
 * CSV completo (até 5000 linhas). Antes lojista exportava 5× pra cobrir
 * um mês; agora 1 click pega o filtro inteiro.
 */
import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { exportOrdersCsv } from "@/actions/order/export-csv";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

interface OrdersExportCsvButtonProps {
  /** Mantido pra compat com chamadores; nome do arquivo vem do server. */
  storeSlug?: string;
}

export function OrdersExportCsvButton(_props: OrdersExportCsvButtonProps) {
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportOrdersCsv({
        q: params.get("q") ?? undefined,
        channel:
          (params.get("channel") as "balcao" | "whatsapp" | null) ?? undefined,
        status:
          (params.get("status") as
            | "quote"
            | "awaiting_whatsapp"
            | "confirmed"
            | "fulfilled"
            | "canceled"
            | "expired"
            | "returned"
            | null) ?? undefined,
        fiado: (params.get("fiado") as "pendente" | null) ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadCsv(result.filename, result.csv);
      toast.success(
        result.truncated
          ? `CSV de ${result.rowCount} vendas baixado (limite 5000 — refine filtro pra mais)`
          : `CSV de ${result.rowCount} vendas baixado.`,
      );
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isPending}
      aria-label="Exportar vendas do filtro atual em CSV"
      title="Baixa o filtro inteiro (até 5000 linhas)"
    >
      <DownloadIcon className="size-3.5" aria-hidden />{" "}
      {isPending ? "Baixando…" : "Exportar CSV"}
    </Button>
  );
}
