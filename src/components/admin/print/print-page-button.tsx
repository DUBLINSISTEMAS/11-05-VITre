"use client";

/**
 * Botão universal "Imprimir página" — Sprint 4 (audit 2026-05-26).
 *
 * Dispara `window.print()` direto na MESMA tab. CSS global em globals.css
 * (@media print) cuida de esconder o chrome do admin (`[data-admin-chrome]`)
 * + ajustar bg/cores. Lojista vê a página em A4 sem sidebar/topbar.
 *
 * Reusável em listagens (pedidos, clientes, estoque), telas de detalhe,
 * configurações. NÃO usar em rotas com ReportLayout (lá o componente já
 * tem o próprio botão).
 *
 * Para impressão de cupom térmico individual (venda balcão), use a rota
 * dedicada `/admin/pedidos/[id]/imprimir?formato=termica`.
 */
import { PrinterIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PrintPageButtonProps {
  label?: string;
  className?: string;
  /**
   * Variant visual — `ghost` (default) cabe em toolbar discreta; `outline`
   * pra contexto onde precisa pesar mais. Mantém a familia b3-btn pra
   * uniformidade com o resto do admin.
   */
  variant?: "ghost" | "outline";
}

export function PrintPageButton({
  label = "Imprimir",
  className,
  variant = "ghost",
}: PrintPageButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "b3-btn b3-btn--sm",
        variant === "outline" && "b3-btn--outline",
        "inline-flex items-center gap-1.5",
        // print:hidden — o próprio botão não aparece no papel
        "print:hidden",
        className,
      )}
      title="Imprimir esta página"
    >
      <PrinterIcon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
