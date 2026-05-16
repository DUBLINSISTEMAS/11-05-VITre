import { HomeIcon, UsersIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { loadCustomerDetail } from "@/actions/customer/load";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { requireSession } from "@/lib/auth-server";

import { EditCustomerForm } from "./edit-customer-form";

export const dynamic = "force-dynamic";

interface EditClientePageProps {
  params: Promise<{ id: string }>;
}

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
      <AdminPageHeader
        title={customer.name}
        subtitle={
          orderCount === 0
            ? "Sem pedidos vinculados ainda."
            : `${orderCount} ${orderCount === 1 ? "pedido vinculado" : "pedidos vinculados"}`
        }
        breadcrumb={[
          { label: "Início", icon: HomeIcon, href: "/admin" },
          { label: "Clientes", icon: UsersIcon, href: "/admin/clientes" },
          { label: customer.name },
        ]}
      />

      <EditCustomerForm
        initialData={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
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
