"use client";

import { useRouter } from "next/navigation";

import { CustomerForm } from "@/components/admin/customer-form";

/**
 * Wrapper client da página /admin/clientes/novo (Fase 3 — ADR-0014).
 *
 * Pós-save: navega pra detalhe do cliente recém-criado pra confirmar
 * cadastro + permitir edição imediata de endereço/notas. Lojista que
 * quer "salvar e adicionar outro" usa o breadcrumb "Clientes" pra voltar
 * e clicar novamente (fricção mínima, evita complexidade de save-and-
 * continue que pegou modal de produto na auditoria 2026-05-12).
 */
export function NewCustomerForm() {
  const router = useRouter();

  return (
    <CustomerForm
      mode="create"
      initialData={{
        name: "",
        phone: "",
        type: "individual",
        document: null,
        email: null,
        addressStreet: null,
        addressNumber: null,
        addressComplement: null,
        addressNeighborhood: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        notes: null,
      }}
      onAfterSave={({ customerId }) => {
        if (customerId) {
          router.push(`/admin/clientes/${customerId}`);
        } else {
          router.push("/admin/clientes");
        }
        router.refresh();
      }}
    />
  );
}
