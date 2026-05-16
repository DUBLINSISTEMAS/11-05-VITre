import { PaymentConfigForm } from "@/components/admin/payment-config-form";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

/**
 * Rota dedicada de Pagamento — Fase 2 / ADR-0013.
 *
 * Separada de `/admin/configuracoes` em 2026-05-16 a pedido do founder:
 * cada domínio funcional do admin tem rota própria (Pagamento, Aparência,
 * Configurações). Memory team `admin-rota-dedicada-por-dominio-2026-05-16`.
 */
export default async function PagamentoPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: pagamento page sem loja");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Pagamento"
        subtitle="Como aparecem parcelas e desconto à vista na sua vitrine e no template do WhatsApp."
      />

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
