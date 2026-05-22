"use client";

// Lista de movimentações de estoque — port Dublin v3 (ADR-0019, Onda A.10).
// REWRITE pra `b3-tbl` canônico (substitui grid custom + mobile cards Fase 4).
// Mobile responsivo via CSS @media 640px no globals.css.
//
// Decisões pixel-perfect vs handoff (B3EstoqueScreen) + schema:
// - Handoff mostra SNAPSHOT de produto (saldo + min + status), Mangos Pay
//   `/admin/estoque` é FEED de movimentações (auditoria event-sourced
//   da Fase 4 ADR-0015). Mantemos semântica Mangos Pay + aplicamos visual Dublin
//   (memory `handoff-vs-schema-respect-data-model`).
// - Pill de tipo usa cores Dublin: ok pra entrada/devolução, danger pra
//   saída/venda, warn pra ajuste, neutro pra initial.
// - Delta number colorido com seta (↑ verde / ↓ vermelho / − cinza).
// - Coluna "Notas / Referência" sumariza ref de pedido (Pedido <slug8>) ou notas.
// - Row clicável → /admin/produtos/<id> com a11y kit.

import {
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { StockMovementRow } from "@/actions/stock/types";
import { formatRelativeDate } from "@/lib/format";

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

const TYPE_PILL: Record<StockMovementRow["movementType"], string> = {
  initial: "b3-pill",
  manual_in: "b3-pill b3-pill--ok",
  manual_out: "b3-pill b3-pill--danger",
  sale: "b3-pill b3-pill--danger",
  return: "b3-pill b3-pill--ok",
  adjustment: "b3-pill b3-pill--warn",
};

export function StockMovementsTable({ movements }: StockMovementsTableProps) {
  const router = useRouter();

  return (
    <table className="b3-tbl">
      <thead>
        <tr>
          <th style={{ paddingLeft: 20 }}>Produto</th>
          <th>Tipo</th>
          <th style={{ textAlign: "right" }}>Qtd</th>
          <th>Notas / Referência</th>
          <th style={{ paddingRight: 20 }}>Quando</th>
        </tr>
      </thead>
      <tbody>
        {movements.map((m) => (
          <tr
            key={m.id}
            onClick={() => router.push(`/admin/produtos/${m.productId}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/admin/produtos/${m.productId}`);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Abrir produto ${m.productName}`}
            className="cursor-pointer outline-none focus-visible:bg-bg-app"
          >
            <td style={{ paddingLeft: 20, fontWeight: 600 }}>
              {m.productName}
              {m.variantName ? (
                <span className="text-ink-4 font-normal"> · {m.variantName}</span>
              ) : null}
            </td>
            <td>
              <span className={TYPE_PILL[m.movementType]}>
                {TYPE_LABEL[m.movementType]}
              </span>
            </td>
            <td style={{ textAlign: "right" }}>
              <DeltaCell delta={m.quantityDelta} />
            </td>
            <td style={{ fontSize: 12, color: "var(--ink-4)" }}>
              <ReferenceCell
                referenceType={m.referenceType}
                referenceId={m.referenceId}
                notes={m.notes}
              />
            </td>
            <td
              className="mono"
              style={{ fontSize: 11.5, color: "var(--ink-4)", paddingRight: 20 }}
            >
              {formatRelativeDate(m.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  const positive = delta > 0;
  const negative = delta < 0;
  const Icon = positive ? ArrowUpIcon : negative ? ArrowDownIcon : MinusIcon;
  const color = positive
    ? "var(--ok)"
    : negative
      ? "var(--danger)"
      : "var(--ink-4)";

  return (
    <span
      className="mono"
      style={{
        color,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        justifyContent: "flex-end",
      }}
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
      <span>
        <span style={{ fontWeight: 600 }}>Venda</span>{" "}
        <span className="mono">{referenceId.slice(0, 8)}…</span>
        {notes ? <span> · {notes}</span> : null}
      </span>
    );
  }
  return <span>{notes ?? "—"}</span>;
}
