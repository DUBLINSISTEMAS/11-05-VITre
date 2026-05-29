"use client";

/**
 * Auto-print on mount + botão "Imprimir novamente". Pequeno trigger local
 * pra rota da ficha de orçamento — espelha o pattern de /admin/pedidos/[id]/imprimir.
 *
 * Mantido inline na rota pra evitar refactor cross-routes; quando entrar a
 * terceira rota imprimível seguindo o mesmo pattern, extrai pra
 * `components/admin/print/`.
 */
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function AutoPrintBar({ backHref }: { backHref: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="sticky top-2 z-10 mx-auto flex max-w-[700px] items-center justify-between gap-2 px-6 py-3 print:hidden">
      <Link
        href={backHref}
        className="text-[12.5px] text-black/60 underline-offset-2 hover:underline"
      >
        ← Voltar
      </Link>
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
