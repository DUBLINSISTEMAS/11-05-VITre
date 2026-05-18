import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

import { NewCustomerForm } from "./new-customer-form";

export const dynamic = "force-dynamic";

/**
 * Novo cliente — Onda A.17 pixel-perfect Dublin v3 (back-row pattern).
 * Page (não drawer) por memory `admin-form-grande-page-not-modal`.
 */
export default async function NovoClientePage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: novo cliente page sem loja");
  }

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
          <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
            Novo cliente
          </h1>
          <p className="text-ink-4 mt-1 text-[13px]">
            Nome e telefone bastam pra começar. Endereço e notas podem entrar
            depois.
          </p>
        </div>
      </div>
      <NewCustomerForm />
    </div>
  );
}
