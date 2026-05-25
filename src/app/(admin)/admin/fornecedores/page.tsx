import { loadSuppliers } from "@/actions/supplier";
import { SuppliersManager } from "@/components/admin/suppliers-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  await requireSession();
  const suppliers = await loadSuppliers();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S14 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub`. Título "Fornecedores" bate handoff stub-pages.jsx:164.
          Subtítulo é mais informativo que o mock — explica integração com
          compras + custo médio móvel. */}
      <div>
        <h1 className="b3-page-title">Fornecedores</h1>
        <p className="b3-page-sub">
          Cadastro de fornecedores pra usar em compras (entrada de mercadoria)
          e rastrear custo médio móvel. Documento opcional (CPF/CNPJ sem máscara).
        </p>
      </div>

      <SuppliersManager initialSuppliers={suppliers} />
    </div>
  );
}
