"use client";

/**
 * Sticky bar com toggle de formato + auto-print on mount + botão "Imprimir
 * novamente". Espelha pattern de /admin/pedidos/[id]/imprimir/print-trigger.
 *
 * `formatKey` força re-disparo do print() quando o lojista troca A4↔térmica
 * (sem ele, [] mount-only não dispara de novo após a navegação).
 */
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface AutoPrintBarProps {
  backHref: string;
  children?: React.ReactNode;
  /** Muda quando o formato muda — força re-disparo do print(). */
  formatKey?: string;
}

export function AutoPrintBar({ backHref, children, formatKey }: AutoPrintBarProps) {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(id);
  }, [formatKey]);

  return (
    <div className="sticky top-2 z-10 mx-auto flex max-w-[700px] items-center justify-between gap-2 px-6 py-3 print:hidden">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="text-[12.5px] text-black/60 underline-offset-2 hover:underline"
        >
          ← Voltar
        </Link>
        {children}
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="bg-foreground text-background inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PrinterIcon className="size-4" aria-hidden />
        Imprimir novamente
      </button>
    </div>
  );
}
