"use client";

/**
 * Listagem de fichas de orçamento de balcão na página `/admin/orcamentos`
 * (2026-05-28). Row click leva pra impressão (V1 sem edit).
 *
 * Mantida separada de `QuotesTable` (orçamento PDV itemizado) porque os
 * dois têm colunas que importam diferentes: aqui o que pesa é entrada
 * vs restante; lá é validade.
 */

import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";

import type { QuoteSheetListRow } from "@/actions/quote-sheet/load-list";
import { formatBRL } from "@/lib/pricing";

interface QuoteSheetsListProps {
  rows: ReadonlyArray<QuoteSheetListRow>;
}

const GRID_TEMPLATE_COLUMNS =
  "100px minmax(0,1.4fr) minmax(0,110px) minmax(0,110px) minmax(0,110px) 20px";

function shortDate(d: Date | null): string {
  if (!d) return "—";
  const day = d.getDate();
  const monthShort = d
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  return `${day} ${monthShort}`;
}

export function QuoteSheetsList({ rows }: QuoteSheetsListProps) {
  if (rows.length === 0) {
    return (
      <div className="b3-card p-8 text-center">
        <FileTextIcon className="text-ink-4 mx-auto h-5 w-5" aria-hidden />
        <p className="text-ink-3 mt-2 text-[13px]">
          Nenhuma ficha de balcão cadastrada.
        </p>
        <p className="text-ink-4 mt-1 text-[12px]">
          Use &quot;Nova ficha&quot; pra criar uma com cliente, peça,
          valor e entrada — imprime A4 com assinaturas.
        </p>
      </div>
    );
  }

  return (
    <div className="b3-card overflow-hidden">
      <div
        className="text-ink-4 hidden border-b border-line bg-bg-app/40 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider md:grid md:gap-3"
        style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
      >
        <span>Código</span>
        <span>Cliente</span>
        <span className="text-right">Valor</span>
        <span className="text-right">Entrada</span>
        <span className="text-right">Restante</span>
        <span aria-hidden />
      </div>

      <ul className="divide-line divide-y">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/orcamentos/ficha/${r.id}/imprimir`}
              prefetch={false}
              className="hover:bg-bg-app/60 flex flex-col gap-1 px-4 py-3 text-[13px] transition-colors md:grid md:items-center md:gap-3"
              style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
              title="Abrir impressão"
            >
              <span className="mono text-ink-2 font-medium tabular-nums">
                #{r.shortCode}
              </span>
              <span className="min-w-0">
                <span className="text-ink-1 block truncate font-medium">
                  {r.customerName}
                </span>
                <span className="text-ink-4 mono block truncate text-[11.5px]">
                  {r.customerPhone ?? shortDate(r.createdAt)}
                </span>
              </span>
              <span className="text-ink-1 mono text-right font-semibold tabular-nums">
                {formatBRL(r.totalInCents)}
              </span>
              <span className="text-ink-3 mono text-right tabular-nums">
                {formatBRL(r.downPaymentInCents)}
              </span>
              <span className="text-ink-1 mono text-right font-semibold tabular-nums">
                {formatBRL(r.remainderInCents)}
              </span>
              <ChevronRightIcon
                size={14}
                className="text-ink-4"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
