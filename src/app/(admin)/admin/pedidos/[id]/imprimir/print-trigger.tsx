"use client";

/**
 * Dispara window.print() ao montar a página /admin/pedidos/[id]/imprimir.
 *
 * Atraso curto pra dar tempo do CSS @media print aplicar antes do diálogo
 * abrir (evita 1º "preview" sem chrome do admin escondido).
 *
 * Botão de retrigger renderizado fora da área impressa (display: none
 * em @media print) — lojista pode imprimir de novo se cancelou.
 */
import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.print();
    }, 200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="sticky top-2 z-10 mx-auto flex max-w-[700px] justify-end px-6 py-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-[13px] font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PrinterIcon className="size-4" aria-hidden />
        Imprimir novamente
      </button>
    </div>
  );
}
