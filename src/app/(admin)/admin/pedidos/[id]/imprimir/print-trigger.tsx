"use client";

/**
 * Dispara window.print() ao montar a página /admin/pedidos/[id]/imprimir.
 *
 * Atraso curto pra dar tempo do CSS @media print aplicar antes do diálogo
 * abrir (evita 1º "preview" sem chrome do admin escondido).
 *
 * Sprint 4 (2026-05-26): aceita slot `children` pra o PrintFormatToggle
 * (térmica vs A4) coabitar na mesma sticky bar. Botão de retrigger
 * permanece à direita.
 *
 * `formatKey` força re-disparo do print() quando o lojista alterna entre
 * térmica/A4 — sem isso, o useEffect [] mount only e troca de formato
 * renderiza o novo layout sem abrir o diálogo de novo. Lojista trocaria
 * formato e precisaria clicar "Imprimir novamente" manualmente.
 */
import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";

interface PrintTriggerProps {
  children?: React.ReactNode;
  /** Chave que muda quando o formato muda — força re-disparo do print(). */
  formatKey?: string;
}

export function PrintTrigger({ children, formatKey }: PrintTriggerProps) {
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.print();
    }, 200);
    return () => window.clearTimeout(id);
  }, [formatKey]);

  return (
    <div className="sticky top-2 z-10 mx-auto flex max-w-[700px] items-center justify-between gap-2 px-6 py-3 print:hidden">
      {children ? <div className="flex items-center gap-2">{children}</div> : <div />}
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
