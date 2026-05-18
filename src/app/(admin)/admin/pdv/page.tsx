import { CalculatorIcon } from "lucide-react";
import Link from "next/link";

import { loadActiveCashSession } from "@/actions/cash-session/load";
import { CashSessionStatus } from "@/components/admin/pdv/cash-session-status";
import { PdvShell } from "@/components/admin/pdv/pdv-shell";

/**
 * PDV / venda balcão (Fase 5 — ADR-0016, port Dublin v3 Onda A.11).
 *
 * Estado client-side (carrinho, cliente, pagamento) — esta venda é
 * efêmera até o lojista clicar "Finalizar". Server-action persiste tudo
 * em uma transação atômica e redireciona pro recibo imprimível.
 *
 * Mobile-first stack; desktop 2 colunas (grid lg:[1fr_400px]).
 *
 * ADR-0022 — banner de status de caixa aparece acima do PdvShell. Se
 * sessão aberta: mostra esperado live + duração + CTA "Caixa". Se
 * fechada: mostra CTA "Abrir caixa" (D1 = opt-in, não bloqueia venda).
 */
export default async function PdvPage() {
  const activeSession = await loadActiveCashSession();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-1">
          PDV · Balcão
        </h1>
        <Link
          href="/admin/pdv/caixa"
          className="b3-btn b3-btn--sm"
          prefetch
        >
          <CalculatorIcon size={13} aria-hidden />
          <span>Caixa do dia</span>
        </Link>
      </div>
      <CashSessionStatus
        active={
          activeSession
            ? {
                id: activeSession.session.id,
                openedAt: activeSession.session.openedAt,
                openingAmountInCents:
                  activeSession.session.openingAmountInCents,
                expectedInCents: activeSession.expectedInCents,
                saleCount: activeSession.saleCount,
              }
            : null
        }
      />
      <PdvShell />
    </div>
  );
}
