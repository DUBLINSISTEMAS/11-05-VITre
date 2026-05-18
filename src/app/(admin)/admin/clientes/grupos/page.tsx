import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { loadCustomerGroups } from "@/actions/customer-group";
import { CustomerGroupsManager } from "@/components/admin/customer-groups-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CustomerGroupsPage() {
  await requireSession();
  const groups = await loadCustomerGroups();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/admin/clientes"
          className="b3-btn b3-btn--sm shrink-0"
          style={{ width: 36, height: 36, padding: 0 }}
          aria-label="Voltar para clientes"
        >
          <ArrowLeftIcon size={14} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Grupos de clientes
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            VIP, Atacado, Comum — cada grupo tem desconto sugerido aplicado
            no PDV quando o cliente é selecionado.
          </p>
        </div>
      </div>

      <CustomerGroupsManager initialGroups={groups} />
    </div>
  );
}
