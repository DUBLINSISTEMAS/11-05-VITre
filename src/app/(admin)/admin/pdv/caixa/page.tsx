import {
  loadActiveCashSession,
  loadCashSessionDetail,
  loadCashSessionsList,
} from "@/actions/cash-session/load";
import { CashSessionLanding } from "@/components/admin/pdv/cash-session-landing";
import { CashSessionMovementsTable } from "@/components/admin/pdv/cash-session-movements-table";

export const dynamic = "force-dynamic";

/**
 * Página "Caixa" — Audit 2026-05-21 + redesign Passo 7 (handoff 2026-05-25).
 *
 * Foco: gestão do CAIXA formal (abrir / acompanhar / fechar Z), não
 * lista de vendas. A visão "Vendas por método" + tabela de vendas
 * detalhada que existia aqui foi removida — era redundante com a página
 * `/admin/pedidos` (vendas) que já mostra essa info melhor com filtros.
 *
 * Lojista vem aqui pra:
 *  - Ver se o caixa tá aberto (e há quanto tempo) — `CashSessionLanding`
 *  - Acompanhar saldo esperado em dinheiro (troco + cash sales − sangria)
 *  - Ver movimentações da sessão (Bloco 2 P1 do CLAUDE.md, fechado no
 *    Passo 7 do redesign — `CashSessionMovementsTable`)
 *  - Fechar caixa Z (entrar o valor real contado, comparar com esperado)
 *  - Ver histórico de fechamentos recentes (últimos 10)
 *
 * Cada fechamento Z tem sua própria rota `/admin/pdv/caixa/[id]` com
 * impressão dedicada (Z gerencial).
 */
export default async function CaixaPage() {
  const [activeSession, sessionsList] = await Promise.all([
    loadActiveCashSession(),
    loadCashSessionsList(10),
  ]);

  // Passo 7 — carrega detalhes (adjustments + sales) só quando há sessão
  // ativa, pra alimentar a tabela de movimentações sem afetar /admin/pedidos
  // ou /admin/pdv (que continuam usando o summary lite).
  const activeDetail = activeSession
    ? await loadCashSessionDetail(activeSession.session.id)
    : null;

  return (
    <div className="space-y-6">
      {/* S5 (handoff pixel-perfect 2026-05-25): "Caixa do dia" (handoff
          caixa.jsx:35 e :77) — bate o label da sidebar. h1 vira
          `.b3-page-title`, subtítulo vira `.b3-page-sub` com pill "Aberto"
          inline quando há sessão ativa. */}
      <div>
        <h1 className="b3-page-title">Caixa do dia</h1>
        <p className="b3-page-sub flex flex-wrap items-center gap-2">
          {activeSession ? (
            <>
              <span className="b3-pill b3-pill--ok inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full bg-ok"
                  aria-hidden
                />
                Aberto
              </span>
              <span>
                Aberto às{" "}
                {activeSession.session.openedAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · "}
                {activeSession.saleCount}{" "}
                {activeSession.saleCount === 1 ? "venda balcão" : "vendas balcão"}
              </span>
            </>
          ) : (
            <span>
              Controle o caixa formal — abrir, acompanhar saldo, sangria e
              fechamento Z.
            </span>
          )}
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

      {activeDetail ? (
        <CashSessionMovementsTable
          sales={activeDetail.sales}
          adjustments={activeDetail.adjustments}
        />
      ) : null}
    </div>
  );
}
