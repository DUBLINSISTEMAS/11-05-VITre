import {
  loadActiveCashSession,
  loadCashSessionsList,
} from "@/actions/cash-session/load";
import { CashSessionLanding } from "@/components/admin/pdv/cash-session-landing";

export const dynamic = "force-dynamic";

/**
 * Página "Caixa" — Audit 2026-05-21.
 *
 * Foco: gestão do CAIXA formal (abrir / acompanhar / fechar Z), não
 * lista de vendas. A visão "Vendas por método" + tabela de vendas
 * detalhada que existia aqui foi removida — era redundante com a página
 * `/admin/pedidos` (vendas) que já mostra essa info melhor com filtros.
 *
 * Lojista vem aqui pra:
 *  - Ver se o caixa tá aberto (e há quanto tempo) — `CashSessionLanding`
 *  - Acompanhar saldo esperado em dinheiro (troco + cash sales − sangria)
 *  - Fechar caixa Z (entrar o valor real contado, comparar com esperado)
 *  - Ver histórico de fechamentos recentes (últimos 10)
 *
 * Cada fechamento Z tem sua própria rota `/admin/pdv/caixa/[id]` com
 * impressão dedicada (Z gerencial).
 *
 * O filtro de período (data picker) que existia foi removido porque
 * servia só pra filtrar a visão de vendas — que saiu. Se o lojista
 * precisar consultar histórico mais antigo, abre fechamentos do
 * `CashSessionLanding`.
 */
export default async function CaixaPage() {
  const [activeSession, sessionsList] = await Promise.all([
    loadActiveCashSession(),
    loadCashSessionsList(10),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Caixa
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Controle o caixa formal — abrir, acompanhar saldo, sangria e
          fechamento Z. Vendas detalhadas ficam em Vendas.
        </p>
      </div>

      <CashSessionLanding
        active={
          activeSession
            ? {
                id: activeSession.session.id,
                openedAt: activeSession.session.openedAt,
                openingAmountInCents:
                  activeSession.session.openingAmountInCents,
                cashSalesInCents: activeSession.cashSalesInCents,
                sangriaInCents: activeSession.sangriaInCents,
                reinforcementInCents: activeSession.reinforcementInCents,
                expectedInCents: activeSession.expectedInCents,
                saleCount: activeSession.saleCount,
              }
            : null
        }
        history={sessionsList.map((s) => ({
          id: s.id,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openingAmountInCents: s.openingAmountInCents,
          closingActualInCents: s.closingActualInCents,
        }))}
      />
    </div>
  );
}
