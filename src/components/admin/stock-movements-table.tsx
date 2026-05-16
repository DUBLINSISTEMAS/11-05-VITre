import { ArrowDownIcon, ArrowUpIcon, MinusIcon, PackageIcon } from "lucide-react";
import Link from "next/link";

import type { StockMovementRow } from "@/actions/stock/load";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StockMovementsTableProps {
  movements: ReadonlyArray<StockMovementRow>;
}

const TYPE_LABEL: Record<StockMovementRow["movementType"], string> = {
  initial: "Saldo inicial",
  manual_in: "Entrada",
  manual_out: "Saída",
  sale: "Venda",
  return: "Devolução",
  adjustment: "Ajuste",
};

const TYPE_BADGE_CLASS: Record<StockMovementRow["movementType"], string> = {
  initial: "bg-muted text-muted-foreground",
  manual_in: "bg-emerald-100 text-emerald-700",
  manual_out: "bg-rose-100 text-rose-700",
  sale: "bg-rose-100 text-rose-700",
  return: "bg-emerald-100 text-emerald-700",
  adjustment: "bg-amber-100 text-amber-800",
};

export function StockMovementsTable({ movements }: StockMovementsTableProps) {
  return (
    <>
      {/* Desktop */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-muted/50 grid grid-cols-[minmax(0,1.4fr)_minmax(0,140px)_minmax(0,100px)_minmax(0,1fr)_minmax(0,130px)] items-center gap-4 border-b px-4 py-2.5"
        >
          <span>Produto</span>
          <span>Tipo</span>
          <span className="text-right">Qtd</span>
          <span>Notas / Referência</span>
          <span>Quando</span>
        </div>

        <ul className="divide-border divide-y">
          {movements.map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,140px)_minmax(0,100px)_minmax(0,1fr)_minmax(0,130px)] items-center gap-4 px-4 py-2.5 text-sm"
            >
              <Link
                href={`/admin/produtos/${m.productId}`}
                prefetch={false}
                className="min-w-0 truncate font-medium hocus:underline"
              >
                {m.productName}
                {m.variantName ? (
                  <span className="text-muted-foreground"> · {m.variantName}</span>
                ) : null}
              </Link>
              <span>
                <span
                  className={cn(
                    "inline-block rounded-md px-2 py-0.5 text-[11px] font-medium",
                    TYPE_BADGE_CLASS[m.movementType],
                  )}
                >
                  {TYPE_LABEL[m.movementType]}
                </span>
              </span>
              <DeltaCell delta={m.quantityDelta} />
              <ReferenceCell
                referenceType={m.referenceType}
                referenceId={m.referenceId}
                notes={m.notes}
              />
              <span className="text-muted-foreground text-[12.5px]">
                {formatRelativeDate(m.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile */}
      <ul className="divide-border divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {movements.map((m) => (
          <li key={m.id} className="px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <PackageIcon className="text-muted-foreground size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/produtos/${m.productId}`}
                  prefetch={false}
                  className="block truncate text-[13.5px] font-medium leading-tight hocus:underline"
                >
                  {m.productName}
                </Link>
                {m.variantName ? (
                  <p className="text-muted-foreground text-[11.5px] leading-tight">
                    {m.variantName}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium",
                      TYPE_BADGE_CLASS[m.movementType],
                    )}
                  >
                    {TYPE_LABEL[m.movementType]}
                  </span>
                  <DeltaCell delta={m.quantityDelta} compact />
                  <span className="text-muted-foreground text-[11px]">
                    {formatRelativeDate(m.createdAt)}
                  </span>
                </div>
                {m.notes ? (
                  <p className="text-muted-foreground mt-1 truncate text-[11.5px] leading-snug">
                    {m.notes}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DeltaCell({ delta, compact }: { delta: number; compact?: boolean }) {
  const positive = delta > 0;
  const negative = delta < 0;
  const Icon = positive ? ArrowUpIcon : negative ? ArrowDownIcon : MinusIcon;
  const color = positive
    ? "text-emerald-700"
    : negative
      ? "text-rose-700"
      : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono tabular-nums",
        color,
        compact ? "text-[11px]" : "text-[13px] justify-end",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(delta)}
    </span>
  );
}

function ReferenceCell({
  referenceType,
  referenceId,
  notes,
}: {
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
}) {
  if (referenceType === "order" && referenceId) {
    return (
      <span className="text-muted-foreground min-w-0 text-[12px]">
        <span className="font-medium">Pedido</span>{" "}
        <Link
          href={`/admin/pedidos?q=${encodeURIComponent(referenceId.slice(0, 8))}`}
          prefetch={false}
          className="hocus:underline font-mono"
        >
          {referenceId.slice(0, 8)}…
        </Link>
        {notes ? <span className="ml-1 truncate"> · {notes}</span> : null}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground min-w-0 truncate text-[12px]">
      {notes ?? "—"}
    </span>
  );
}
