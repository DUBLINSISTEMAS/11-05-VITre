import { loadBrands } from "@/actions/brand";
import { BrandsManager } from "@/components/admin/brands-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function MarcasPage() {
  await requireSession();
  const brands = await loadBrands();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Marcas
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Cadastro reutilizável de marcas pra filtrar produtos e padronizar
          relatórios. Produtos antigos com marca em texto livre continuam
          funcionando (snapshot histórico preservado).
        </p>
      </div>

      <BrandsManager initialBrands={brands} />
    </div>
  );
}
