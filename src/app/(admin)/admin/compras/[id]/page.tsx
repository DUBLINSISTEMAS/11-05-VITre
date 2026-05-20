import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPurchaseDetail } from "@/actions/purchase";
import { PurchaseDetailView } from "@/components/admin/purchase-detail-view";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

interface CompraDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompraDetailPage({
  params,
}: CompraDetailPageProps) {
  await requireSession();
  const { id } = await params;
  const detail = await loadPurchaseDetail(id);
  if (!detail) notFound();

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
            {detail.purchase.invoiceNumber
              ? `Compra NF ${detail.purchase.invoiceNumber}`
              : `Compra #${detail.purchase.id.slice(0, 8)}`}
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            {detail.supplierName ?? "Sem fornecedor"} ·{" "}
            {detail.purchase.createdAt.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <PurchaseDetailView detail={detail} />
    </div>
  );
}
