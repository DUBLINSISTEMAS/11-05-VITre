import { loadPendingReceivables } from "@/actions/receivable/load-pending";
import { ReceivablesList } from "@/components/admin/receivables-list";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AReceberPage() {
  await requireSession();
  const data = await loadPendingReceivables();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          A receber (fiado)
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Vendas fiadas pendentes de pagamento. Marcar como pago gera entrada
          automática no caixa aberto (quando houver sessão ativa).
        </p>
      </div>

      <ReceivablesList rows={data.rows} totals={data.totals} />
    </div>
  );
}
