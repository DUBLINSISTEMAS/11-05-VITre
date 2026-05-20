import { loadPendingReceivables } from "@/actions/receivable/load-pending";
import { ReceivablesHeader } from "@/components/admin/receivables-header";
import { ReceivablesList } from "@/components/admin/receivables-list";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AReceberPage() {
  await requireSession();
  const data = await loadPendingReceivables();

  return (
    <div className="space-y-4 sm:space-y-6">
      <ReceivablesHeader />
      <ReceivablesList rows={data.rows} totals={data.totals} />
    </div>
  );
}
