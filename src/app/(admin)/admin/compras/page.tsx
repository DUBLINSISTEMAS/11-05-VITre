import { PlusIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

import { loadPurchases } from "@/actions/purchase";
import { PurchasesTable } from "@/components/admin/purchases-table";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  await requireSession();
  const purchases = await loadPurchases();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Compras
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            Registro de entradas de mercadoria. Cada compra atualiza o custo
            do produto pelo método de custo médio móvel ponderado, soma ao
            estoque e gera movimentação na auditoria.
          </p>
        </div>
        <Link
          href="/admin/compras/novo"
          className="b3-btn b3-btn--cta gap-2"
          prefetch
        >
          <PlusIcon size={14} /> Nova compra
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
          <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
            <ShoppingCartIcon className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-ink-1">
            Nenhuma compra registrada
          </h2>
          <p className="text-ink-4 max-w-sm text-sm">
            Quando você lança uma entrada de mercadoria, o sistema atualiza
            estoque, custo médio do produto e gera a movimentação. Comece
            registrando sua primeira compra.
          </p>
          <Link
            href="/admin/compras/novo"
            className="b3-btn b3-btn--cta gap-2 mt-2"
            prefetch
          >
            <PlusIcon size={14} /> Registrar primeira compra
          </Link>
        </div>
      ) : (
        <PurchasesTable purchases={purchases} />
      )}
    </div>
  );
}
