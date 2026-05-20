import { asc, eq } from "drizzle-orm";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { supplierTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { NewPurchaseForm } from "./new-purchase-form";

export const dynamic = "force-dynamic";

export default async function NovaCompraPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: nova compra page sem loja");
  }

  // Lista de fornecedores ATIVOS pro select.
  const suppliers = await withTenant(store.id, session.user.id, async (tx) =>
    tx
      .select({
        id: supplierTable.id,
        name: supplierTable.name,
        isActive: supplierTable.isActive,
      })
      .from(supplierTable)
      .where(eq(supplierTable.storeId, store.id))
      .orderBy(asc(supplierTable.name)),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/admin/compras"
          aria-label="Voltar para compras"
          className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
        >
          <ChevronLeftIcon size={15} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Nova compra
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            Registre entrada de mercadoria. Estoque atualiza automaticamente
            e o custo do produto é recalculado por média ponderada.
          </p>
        </div>
      </div>

      <NewPurchaseForm suppliers={suppliers.filter((s) => s.isActive)} />
    </div>
  );
}
