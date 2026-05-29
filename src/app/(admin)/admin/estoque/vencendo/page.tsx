/**
 * /admin/estoque/vencendo — S3.4 do Plano de Endurecimento.
 *
 * Lotes vencendo em 60 dias (perfumaria/cosmético). FEFO ordenado.
 * Vencidos no topo destacados em vermelho.
 */
import { TicketPercentIcon } from "lucide-react";
import Link from "next/link";

import { loadExpiringBatches } from "@/actions/stock/load-expiring";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function EstoqueVencendoPage() {
  await requireSession();
  const data = await loadExpiringBatches(60);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="b3-page-title">Estoque vencendo</h1>
        <p className="b3-page-sub">
          Lotes nos próximos 60 dias. Use FEFO (First-Expired-First-Out) —
          vendendo do mais antigo evita perda + multa Vigilância.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="b3-card border-destructive/50 p-4">
          <p className="text-ink-3 text-xs">Já vencidos</p>
          <p className="text-destructive mt-1 text-2xl font-semibold">
            {data.kpi.expiredCount}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiredValueInCents)} — descarte ou
            doação
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Vencem em 30 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {data.kpi.expiringIn30Count}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiringIn30ValueInCents)} — promo
            urgente
          </p>
        </div>
        <div className="b3-card p-4">
          <p className="text-ink-3 text-xs">Vencem em 60 dias</p>
          <p className="text-ink-1 mt-1 text-2xl font-semibold">
            {data.kpi.expiringIn60Count}
          </p>
          <p className="text-ink-4 mt-1 text-[11px]">
            Capital: {formatBRL(data.kpi.expiringIn60ValueInCents)} — vender
            primeiro
          </p>
        </div>
      </div>

      {/* Tabela */}
      {data.rows.length === 0 ? (
        <div className="b3-card p-8 text-center">
          <p className="text-ink-3 text-sm">Nenhum lote vencendo em 60 dias.</p>
          <p className="text-ink-4 mt-1 text-xs">
            Esta tela mostra lotes vencendo de produtos comprados via{" "}
            <a href="/admin/compras" className="font-medium underline">
              Compras
            </a>{" "}
            que tenham lote e validade. Faz sentido pra perfumaria, cosmético,
            alimento — categorias com prazo. Marque a categoria como
            &ldquo;rastrear lote&rdquo; no cadastro pra os campos aparecerem
            na próxima compra.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-table w-full">
            <thead>
              <tr>
                <th className="text-left">Produto</th>
                <th className="text-left">Lote</th>
                <th className="text-left">Vencimento</th>
                <th className="text-right">Quantidade</th>
                <th className="text-right">Valor</th>
                <th className="text-left">Situação</th>
                <th className="text-center" style={{ width: 140 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.purchaseItemId}>
                  <td>
                    <Link
                      href={`/admin/produtos?edit=${r.productId}`}
                      className="text-ink-1 text-sm hover:underline"
                    >
                      {r.productName}
                    </Link>
                  </td>
                  <td className="text-ink-2 mono text-sm">
                    {r.batchNumber ?? "—"}
                  </td>
                  <td className="text-ink-2 mono text-sm">
                    {new Date(r.expiresAt).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="text-ink-2 mono text-right text-sm">
                    {r.quantityPurchased}
                  </td>
                  <td className="text-ink-1 mono text-right text-sm font-medium">
                    {formatBRL(r.parkedValueInCents)}
                  </td>
                  <td>
                    {r.daysToExpiry < 0 ? (
                      <span className="b3-pill b3-pill--danger inline-flex items-center">
                        Vencido há {-r.daysToExpiry}d
                      </span>
                    ) : r.daysToExpiry <= 30 ? (
                      <span className="b3-pill b3-pill--warn inline-flex items-center">
                        Vence em {r.daysToExpiry}d
                      </span>
                    ) : (
                      <span className="b3-pill b3-pill--brand inline-flex items-center">
                        Vence em {r.daysToExpiry}d
                      </span>
                    )}
                  </td>
                  <td>
                    {/* Bloco G UX (2026-05-29) — antes mostrava lote
                        vencendo e ZERO CTA. Agora link rápido pra criar
                        promoção e liquidar antes da perda total. */}
                    <div className="flex items-center justify-center">
                      <Link
                        href={`/admin/promocoes/cupons?produto=${r.productId}`}
                        prefetch={false}
                        className="b3-btn b3-btn--sm"
                        title={`Criar código de desconto pra liquidar ${r.productName} antes do vencimento`}
                      >
                        <TicketPercentIcon size={12} aria-hidden /> Promo
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
