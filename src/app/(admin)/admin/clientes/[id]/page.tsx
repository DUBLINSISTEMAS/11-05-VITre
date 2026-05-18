import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCustomerDetail } from "@/actions/customer/load";
import { requireSession } from "@/lib/auth-server";

import { EditCustomerForm } from "./edit-customer-form";

export const dynamic = "force-dynamic";

interface EditClientePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edição cliente — Onda A.17 pixel-perfect Dublin v3.
 * Back-row pattern + pill com count de pedidos vinculados (handoff
 * B3ClienteDetalheScreen bagy-admin.jsx:331).
 */
export default async function EditClientePage({ params }: EditClientePageProps) {
  await requireSession();
  const { id } = await params;
  const detail = await loadCustomerDetail(id);
  if (!detail) {
    notFound();
  }

  const { customer, orderCount, recentOrders } = detail;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/admin/clientes"
          aria-label="Voltar para clientes"
          className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
        >
          <ChevronLeftIcon size={15} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-ink-1 truncate text-[22px] font-bold tracking-[-0.025em]">
              {customer.name}
            </h1>
            {orderCount > 0 ? (
              <span className="b3-pill b3-pill--brand">
                {orderCount}{" "}
                {orderCount === 1 ? "pedido" : "pedidos"}
              </span>
            ) : (
              <span className="b3-pill">Sem pedidos</span>
            )}
          </div>
          <p className="text-ink-4 mt-1 text-[13px]">
            {orderCount === 0
              ? "Sem pedidos vinculados ainda. Vincule pedidos antigos pelo /admin/pedidos."
              : `${orderCount} ${orderCount === 1 ? "pedido vinculado" : "pedidos vinculados"}.`}
          </p>
        </div>
      </div>

      <EditCustomerForm
        initialData={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          type: customer.type,
          document: customer.document,
          email: customer.email,
          addressStreet: customer.addressStreet,
          addressNumber: customer.addressNumber,
          addressComplement: customer.addressComplement,
          addressNeighborhood: customer.addressNeighborhood,
          addressCity: customer.addressCity,
          addressState: customer.addressState,
          addressZip: customer.addressZip,
          notes: customer.notes,
        }}
        recentOrders={recentOrders.map((o) => ({
          id: o.id,
          shortCode: o.shortCode,
          totalInCents: o.totalInCents,
          status: o.status,
          createdAt: o.createdAt,
        }))}
        orderCount={orderCount}
      />
    </div>
  );
}
