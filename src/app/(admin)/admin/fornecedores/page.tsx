import { loadSuppliers } from "@/actions/supplier";
import { SuppliersManager } from "@/components/admin/suppliers-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  await requireSession();
  const suppliers = await loadSuppliers();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Fornecedores
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Cadastro de fornecedores pra usar em compras (entrada de mercadoria)
          e rastrear custo médio móvel. Documento opcional (CPF/CNPJ sem máscara).
        </p>
      </div>

      <SuppliersManager initialSuppliers={suppliers} />
    </div>
  );
}
