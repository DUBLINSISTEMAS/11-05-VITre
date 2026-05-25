// Tabela de movimentações da sessão de caixa ativa — handoff Passo 7.
//
// Fecha o gap apontado no Bloco 2 P1 do CLAUDE.md: "Caixa NÃO mostra
// vendas detalhadas da sessão". Lojista fechando Z merece ver vendas +
// sangrias + reforços + outros adjustments em ordem cronológica sem
// abrir cada item.
//
// Server component — recebe `sales` e `adjustments` já carregados do
// loadCashSessionDetail. Sem state. Click em #código de venda navega
// pra /admin/pedidos?detail=<id> e o drawer global abre.

import Link from "next/link";

import type { CashAdjustment } from "@/db/schema";
import { formatBRL } from "@/lib/pricing";

interface CashSessionSaleRow {
  id: string;
  shortCode: string;
  totalInCents: number;
  paymentMethod: string | null;
  createdAt: Date;
  customerName: string | null;
}

interface CashSessionMovementsTableProps {
  sales: ReadonlyArray<CashSessionSaleRow>;
  adjustments: ReadonlyArray<CashAdjustment>;
}

type MovementKind =
  | "sale"
  | "sangria"
  | "reinforcement"
  | "pay_supplier"
  | "pay_bill"
  | "other_in"
  | "other_out";

interface MovementEvent {
  id: string;
  kind: MovementKind;
  amountInCents: number;
  /** Positivo se entra no caixa, negativo se sai. PIX/cartão = 0 (info). */
  signedCents: number;
  createdAt: Date;
  shortCode: string | null;
  description: string;
}

const KIND_LABEL: Record<MovementKind, string> = {
  sale: "Venda",
  sangria: "Sangria",
  reinforcement: "Reforço",
  pay_supplier: "Fornecedor",
  pay_bill: "Conta",
  other_in: "Entrada",
  other_out: "Saída",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

function pillClass(kind: MovementKind): string {
  switch (kind) {
    case "sale":
    case "reinforcement":
    case "other_in":
      return "b3-pill b3-pill--ok";
    case "sangria":
    case "pay_supplier":
    case "pay_bill":
    case "other_out":
      return "b3-pill b3-pill--danger";
  }
}

export function CashSessionMovementsTable({
  sales,
  adjustments,
}: CashSessionMovementsTableProps) {
  const events: MovementEvent[] = [
    // Vendas — PIX/cartão entram como informação (signedCents=0) pq não
    // afetam o caixa físico; só `cash` adiciona à gaveta.
    ...sales.map<MovementEvent>((s) => {
      const isCash = s.paymentMethod === "cash";
      return {
        id: `sale-${s.id}`,
        kind: "sale",
        amountInCents: s.totalInCents,
        signedCents: isCash ? s.totalInCents : 0,
        createdAt: s.createdAt,
        shortCode: s.shortCode,
        description: `${s.customerName ?? "Cliente avulso"} · ${PAYMENT_LABEL[s.paymentMethod ?? "other"] ?? "—"}`,
      };
    }),
    // Adjustments — sinal vem do tipo (in/out).
    ...adjustments.map<MovementEvent>((a) => {
      const isOut =
        a.type === "sangria" ||
        a.type === "pay_supplier" ||
        a.type === "pay_bill" ||
        a.type === "other_out";
      return {
        id: `adj-${a.id}`,
        kind: a.type as MovementKind,
        amountInCents: a.amountInCents,
        signedCents: isOut ? -a.amountInCents : a.amountInCents,
        createdAt: a.createdAt,
        shortCode: null,
        description: a.reason ?? "—",
      };
    }),
  ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  if (events.length === 0) {
    return (
      <div className="b3-card overflow-hidden">
        <div className="b3-card-hd">
          <h3>Movimentações</h3>
          <span className="text-ink-4 text-[12px]">0 eventos</span>
        </div>
        <div className="text-ink-4 px-5 py-8 text-center text-[13px]">
          Nada movimentado ainda nessa sessão. Toda venda balcão, sangria ou
          reforço aparece aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="b3-card overflow-hidden">
      <div className="b3-card-hd">
        <h3>Movimentações</h3>
        <span className="text-ink-4 text-[12px]">
          {events.length} {events.length === 1 ? "evento" : "eventos"} nessa sessão
        </span>
      </div>
      <table className="b3-tbl">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Hora</th>
            <th style={{ width: 120 }}>Tipo</th>
            <th style={{ width: 140, textAlign: "right" }}>Valor</th>
            <th style={{ width: 110 }}>Venda</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="text-ink-3 font-mono text-[12.5px] tabular-nums">
                {e.createdAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                <span className={pillClass(e.kind)}>{KIND_LABEL[e.kind]}</span>
              </td>
              <td
                className="font-mono text-right font-semibold tabular-nums"
                style={{
                  color:
                    e.signedCents > 0
                      ? "var(--ok)"
                      : e.signedCents < 0
                        ? "var(--danger)"
                        : "var(--ink-3)",
                }}
              >
                {e.signedCents > 0 ? "+ " : e.signedCents < 0 ? "− " : ""}
                {formatBRL(Math.abs(e.amountInCents))}
                {e.signedCents === 0 ? (
                  <span className="text-ink-4 ml-1 font-sans text-[10px] font-normal italic">
                    (fora do caixa)
                  </span>
                ) : null}
              </td>
              <td className="font-mono text-[12.5px]">
                {e.shortCode ? (
                  <Link
                    href={`/admin/pedidos?detail=${e.id.replace(/^sale-/, "")}`}
                    prefetch={false}
                    className="text-mangos-green-800 hover:underline"
                  >
                    #{e.shortCode}
                  </Link>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
              <td className="text-ink-3 text-[13px]">{e.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
