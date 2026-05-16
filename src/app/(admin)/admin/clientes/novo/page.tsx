import { HomeIcon, UsersIcon } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

import { NewCustomerForm } from "./new-customer-form";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: novo cliente page sem loja");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Novo cliente"
        subtitle="Nome e telefone bastam pra começar. Endereço e notas podem entrar depois."
        breadcrumb={[
          { label: "Início", icon: HomeIcon, href: "/admin" },
          { label: "Clientes", icon: UsersIcon, href: "/admin/clientes" },
          { label: "Novo" },
        ]}
      />
      <NewCustomerForm />
    </div>
  );
}
