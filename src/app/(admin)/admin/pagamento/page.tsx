import { InfoIcon } from "lucide-react";

import { PaymentConfigForm } from "@/components/admin/payment-config-form";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

/**
 * Rota dedicada de Pagamento — Fase 2 / ADR-0013.
 * Onda A.14 pixel-perfect Dublin v3 (B3PagamentosScreen bagy-extra.jsx:601).
 *
 * Separada de `/admin/configuracoes` em 2026-05-16 a pedido do founder:
 * cada domínio funcional do admin tem rota própria (Pagamento, Aparência,
 * Configurações). Memory team `admin-rota-dedicada-por-dominio-2026-05-16`.
 *
 * Handoff trazido: H1 22px + info banner brand-wash "Mangos Pay não processa
 * pagamentos" (educacional). PaymentConfigForm preservado intacto — controla
 * exibição de parcelas/desconto à vista no storefront (Fase 2/ADR-0013), que
 * é semântica Mangos Pay própria não coberta pelo handoff.
 */
export default async function PagamentoPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pagamento page sem loja");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S23 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub (handoff stub-pages.jsx:175 "Formas de pagamento"). */}
      <div>
        <h1 className="b3-page-title">Formas de pagamento</h1>
        <p className="b3-page-sub">
          Como aparecem parcelas e desconto à vista na sua vitrine e no
          template do WhatsApp.
        </p>
      </div>

      <div
        className="b3-card b3-card-pad"
        style={{
          background: "var(--brand-wash)",
          border: "1px solid var(--brand-line)",
        }}
      >
        <div className="flex items-start gap-3">
          <InfoIcon
            size={16}
            className="text-brand mt-[2px] shrink-0"
            aria-hidden
          />
          <div>
            <div className="text-ink-1 text-[14px] font-bold">
              Mangos Pay não processa pagamentos
            </div>
            <div className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">
              Você combina o pagamento direto com o cliente via WhatsApp ou
              recebe no balcão (PDV). Esta tela controla apenas como
              parcelas e desconto à vista aparecem na vitrine.
            </div>
          </div>
        </div>
      </div>

      <PaymentConfigForm
        initialData={{
          acceptsCard: store.acceptsCard,
          cardMaxInstallments: store.cardMaxInstallments,
          installmentBasePrice: store.installmentBasePrice,
          showInstallmentsOnPDP: store.showInstallmentsOnPDP,
          cashDiscountBps: store.cashDiscountBps,
          paymentMethodsNote: store.paymentMethodsNote,
        }}
      />
    </div>
  );
}
